// 全局AI管理器
const AIManager = {
    // 配置中心
    config: {
        maxRetries: 3,
        timeout: 30000,
        cacheExpiry: 300000, // 5分钟缓存
        queueInterval: 500, // 队列处理间隔
        maxConcurrent: 3, // 最大并发请求
    },

    // 场景配置
    sceneConfigs: {
        'private_chat': {
            temperature: 0.85,
            maxTokens: 800,
            systemPromptTemplate: '你是{{name}}，{{background}}。保持角色性格，自然对话。',
            features: ['memory', 'emotion', 'personality'],
            priority: 'high'
        },
        'group_chat': {
            temperature: 0.9,
            maxTokens: 300,
            systemPromptTemplate: '你是群成员{{name}}。简短回复，符合群聊氛围。',
            features: ['brief', 'social'],
            priority: 'medium'
        },
        'forum': {
            temperature: 0.7,
            maxTokens: 1000,
            systemPromptTemplate: '你是{{name}}，在论坛发表观点。保持理性、有深度。',
            features: ['formal', 'detailed'],
            priority: 'low'
        },
        'moments': {
            temperature: 0.85,
            maxTokens: 300,
            systemPromptTemplate: '你是{{name}}，在朋友圈分享生活。轻松、积极、真实。',
            features: ['casual', 'emotional', 'creative'],
            priority: 'medium'
        },
        'card': {
            temperature: 0.8,
            maxTokens: 400,
            systemPromptTemplate: '你是{{name}}，理解并回应卡片内容。',
            features: ['understanding', 'interactive'],
            priority: 'high'
        }
    },

    // 请求队列
    queue: [],
    processing: false,
    activeRequests: 0,

    // 缓存系统
    cache: new Map(),

    // 上下文管理器
    contextManager: {
        contexts: new Map(),
        maxContextLength: 10,

        getContext(sceneId, roleId) {
            const key = `${sceneId}_${roleId}`;
            if (!this.contexts.has(key)) {
                this.contexts.set(key, []);
            }
            return this.contexts.get(key);
        },

        addToContext(sceneId, roleId, message) {
            const context = this.getContext(sceneId, roleId);
            context.push({
                content: message,
                timestamp: Date.now()
            });

            // 限制上下文长度
            if (context.length > this.maxContextLength) {
                context.shift();
            }
        },

        clearContext(sceneId, roleId) {
            const key = `${sceneId}_${roleId}`;
            this.contexts.delete(key);
        }
    },

    // 角色管理器
    roleManager: {
        roles: new Map(),

        registerRole(roleId, roleData) {
            this.roles.set(roleId, {
                ...roleData,
                consistency: {
                    tone: roleData.personality || 'friendly',
                    traits: roleData.traits || [],
                    memories: []
                }
            });
        },

        getRole(roleId) {
            return this.roles.get(roleId) || {
                name: '助手',
                background: '',
                consistency: { tone: 'friendly', traits: [], memories: [] }
            };
        },

        updateRoleMemory(roleId, memory) {
            const role = this.getRole(roleId);
            role.consistency.memories.push({
                content: memory,
                timestamp: Date.now()
            });

            // 保持最近20条记忆
            if (role.consistency.memories.length > 20) {
                role.consistency.memories.shift();
            }
        }
    },

    // 主请求方法
    async request(options) {
        const {
            scene,           // 场景类型
            roleId,          // 角色ID
            message,         // 用户消息
            context = [],    // 额外上下文
            metadata = {},   // 元数据
            priority = null, // 优先级覆盖
            skipCache = false // 跳过缓存
        } = options;

        // 生成缓存键
        const cacheKey = this.generateCacheKey(scene, roleId, message);

        // 检查缓存
        if (!skipCache && this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.config.cacheExpiry) {
                console.log('使用缓存响应:', cacheKey);
                return cached.response;
            }
        }

        // 创建请求对象
        const request = {
            id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            scene,
            roleId,
            message,
            context,
            metadata,
            priority: priority || this.sceneConfigs[scene]?.priority || 'medium',
            timestamp: Date.now(),
            retries: 0,
            deferred: {}
        };

        // 创建Promise
        const promise = new Promise((resolve, reject) => {
            request.deferred.resolve = resolve;
            request.deferred.reject = reject;
        });

        // 加入队列
        this.enqueue(request);

        // 开始处理队列
        this.processQueue();

        return promise;
    },

    // 入队
    enqueue(request) {
        // 根据优先级插入队列
        const priorities = { high: 0, medium: 1, low: 2 };
        const priority = priorities[request.priority];

        let inserted = false;
        for (let i = 0; i < this.queue.length; i++) {
            if (priorities[this.queue[i].priority] > priority) {
                this.queue.splice(i, 0, request);
                inserted = true;
                break;
            }
        }

        if (!inserted) {
            this.queue.push(request);
        }

        console.log(`请求入队 [${request.priority}]:`, request.id);
    },

    // 处理队列
    async processQueue() {
        if (this.processing || this.queue.length === 0) return;
        if (this.activeRequests >= this.config.maxConcurrent) {
            // 等待后重试
            setTimeout(() => this.processQueue(), this.config.queueInterval);
            return;
        }

        this.processing = true;

        while (this.queue.length > 0 && this.activeRequests < this.config.maxConcurrent) {
            const request = this.queue.shift();
            this.activeRequests++;

            // 异步处理请求
            this.handleRequest(request).then(response => {
                request.deferred.resolve(response);
                this.activeRequests--;

                // 缓存结果
                const cacheKey = this.generateCacheKey(request.scene, request.roleId, request.message);
                this.cache.set(cacheKey, {
                    response,
                    timestamp: Date.now()
                });

                // 清理过期缓存
                this.cleanCache();
            }).catch(error => {
                request.deferred.reject(error);
                this.activeRequests--;
            });

            // 请求间隔
            await this.sleep(this.config.queueInterval);
        }

        this.processing = false;

        // 如果还有请求，继续处理
        if (this.queue.length > 0) {
            setTimeout(() => this.processQueue(), this.config.queueInterval);
        }
    },

    // 处理单个请求
    async handleRequest(request) {
        console.log(`处理请求:`, request.id, request.scene);

        try {
            // 获取场景配置
            const sceneConfig = this.sceneConfigs[request.scene] || this.sceneConfigs['private_chat'];

            // 获取角色信息
            const role = this.roleManager.getRole(request.roleId);

            // 构建系统提示
            const systemPrompt = this.buildSystemPrompt(sceneConfig, role, request);

            // 获取历史上下文
            const historicalContext = this.contextManager.getContext(request.scene, request.roleId);

            // 构建完整消息
            const messages = this.buildMessages(systemPrompt, historicalContext, request);

            // 调用API
            const response = await this.callAPI(messages, sceneConfig, request);

            // 更新上下文
            this.contextManager.addToContext(request.scene, request.roleId, request.message);
            this.contextManager.addToContext(request.scene, request.roleId, response);

            // 更新角色记忆
            this.roleManager.updateRoleMemory(request.roleId, {
                scene: request.scene,
                message: request.message,
                response: response
            });

            return response;

        } catch (error) {
            console.error('请求处理失败:', error);

            // 重试逻辑
            if (request.retries < this.config.maxRetries) {
                request.retries++;
                console.log(`重试请求 (${request.retries}/${this.config.maxRetries}):`, request.id);
                this.queue.unshift(request); // 重新加入队列前端
                throw new Error('请求失败，正在重试...');
            }

            // 降级处理
            return this.getFallbackResponse(request);
        }
    },

    // 
    // 构建系统提示 - 替换原有的 buildSystemPrompt 函数  个人板块
    buildSystemPrompt(sceneConfig, role, request) {
        let prompt = sceneConfig.systemPromptTemplate;

        // 替换模板变量
        prompt = prompt.replace('{{name}}', role.name || '助手');
        prompt = prompt.replace('{{background}}', role.background || '');

        // 添加用户人设信息
        loadUserPersona(); // 确保加载最新人设
        if (currentUserPersona) {
            prompt += `\n\n用户信息：
- 名字：${currentUserPersona.name}
- 性别：${currentUserPersona.gender === 'male' ? '男' : currentUserPersona.gender === 'female' ? '女' : '其他'}
- 背景：${currentUserPersona.background || '普通用户'}
- 账户余额：¥${window.PersonalModule?.getAccountBalance() || 10000}

请根据用户的性别、背景和身份做出合适的回应。`;
        }

        // 添加场景特定指令
        if (sceneConfig.features.includes('memory')) {
            prompt += '\n记住之前的对话内容。';
        }
        if (sceneConfig.features.includes('emotion')) {
            prompt += '\n表现出适当的情感。';
        }
        if (sceneConfig.features.includes('brief')) {
            prompt += '\n保持回复简短。';
        }
        if (sceneConfig.features.includes('formal')) {
            prompt += '\n使用正式的语言。';
        }

        // 添加时间信息
        const now = new Date();
        prompt += `\n当前时间：${now.toLocaleString('zh-CN')}`;

        // 检查今日日历提醒
        if (window.PersonalModule) {
            const reminders = window.PersonalModule.checkCalendarReminders();
            if (reminders.length > 0) {
                prompt += '\n\n今日提醒事项：';
                reminders.forEach(r => {
                    prompt += `\n- ${r.content} (${r.reminderTime})`;
                });
            }
        }

        return prompt;
    },















    // 构建消息列表
    buildMessages(systemPrompt, historicalContext, request) {
        const messages = [
            { role: 'system', content: systemPrompt }
        ];

        // 添加历史上下文（最近的几条）
        const recentContext = historicalContext.slice(-6);
        recentContext.forEach(ctx => {
            messages.push({
                role: ctx.content.startsWith('[AI]') ? 'assistant' : 'user',
                content: ctx.content.replace(/^\[(AI|User)\]\s*/, '')
            });
        });

        // 添加额外上下文
        if (request.context && request.context.length > 0) {
            request.context.forEach(ctx => {
                messages.push({
                    role: ctx.role || 'user',
                    content: ctx.content
                });
            });
        }

        // 添加当前消息
        messages.push({ role: 'user', content: request.message });

        return messages;
    },

    // 调用API
    async callAPI(messages, sceneConfig, request) {
        // 获取API配置
        const provider = document.getElementById('provider')?.value;
        const apiUrl = document.getElementById('apiUrl')?.value;
        const apiKey = document.getElementById('apiKey')?.value;
        const model = document.getElementById('model')?.value;

        if (!apiUrl || !apiKey || !model) {
            throw new Error('API配置不完整');
        }

        let response;

        if (provider === 'google') {
            response = await this.callGoogleAPI(messages, sceneConfig, apiUrl, apiKey, model);
        } else {
            response = await this.callOpenAIAPI(messages, sceneConfig, apiUrl, apiKey, model);
        }

        return response;
    },

    // Google API调用
    async callGoogleAPI(messages, sceneConfig, apiUrl, apiKey, model) {
        // 转换消息格式
        const contents = messages.map(msg => ({
            parts: [{ text: msg.content }]
        }));

        const response = await fetch(`${apiUrl}/models/${model}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: contents,
                generationConfig: {
                    temperature: sceneConfig.temperature,
                    maxOutputTokens: sceneConfig.maxTokens
                }
            })
        });

        if (!response.ok) {
            throw new Error(`API请求失败: ${response.status}`);
        }

        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || '...';
    },

    // OpenAI兼容API调用
    async callOpenAIAPI(messages, sceneConfig, apiUrl, apiKey, model) {
        const response = await fetch(`${apiUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: model,
                messages: messages,
                temperature: sceneConfig.temperature,
                max_tokens: sceneConfig.maxTokens,
                stream: false
            })
        });

        if (!response.ok) {
            throw new Error(`API请求失败: ${response.status}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || '...';
    },

    // 降级响应
    getFallbackResponse(request) {
        const fallbacks = {
            'private_chat': ['嗯嗯，我明白了', '好的呢~', '收到！', '哈哈，是这样的'],
            'group_chat': ['+1', '赞同', '有道理', '确实'],
            'forum': ['这是个很好的观点', '值得讨论', '我也这么认为'],
            'moments': ['👍', '很棒！', '真不错', '支持！'],
            'card': ['收到卡片了', '很有意思的内容', '我看到了']
        };

        const responses = fallbacks[request.scene] || fallbacks['private_chat'];
        return responses[Math.floor(Math.random() * responses.length)];
    },

    // 生成缓存键
    generateCacheKey(scene, roleId, message) {
        // 简化消息用于缓存键（取前50字符）
        const simplifiedMessage = message.substring(0, 50).toLowerCase().replace(/\s+/g, '_');
        return `${scene}_${roleId}_${simplifiedMessage}`;
    },

    // 清理缓存
    cleanCache() {
        const now = Date.now();
        for (const [key, value] of this.cache.entries()) {
            if (now - value.timestamp > this.config.cacheExpiry) {
                this.cache.delete(key);
            }
        }
    },

    // 辅助方法
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    // 批量请求（用于群聊）
    async batchRequest(requests) {
        const promises = requests.map(req => this.request(req));
        return Promise.all(promises);
    },

    // 获取统计信息
    getStats() {
        return {
            queueLength: this.queue.length,
            activeRequests: this.activeRequests,
            cacheSize: this.cache.size,
            contextSize: this.contextManager.contexts.size,
            rolesRegistered: this.roleManager.roles.size
        };
    }
};
// Loading animation
window.addEventListener('load', () => {
    setTimeout(() => {
        document.getElementById('loadingScreen').classList.add('hidden');
        document.getElementById('mainContainer').classList.add('visible');
    }, 3500);
});

// Navigation function
// Navigation function
function showSection(sectionName) {
    // Hide all sections
    const sections = document.querySelectorAll('.module-section');
    sections.forEach(section => section.classList.remove('active'));

    // Remove active class from all nav items
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => item.classList.remove('active'));

    // Show selected section
    const targetSection = document.getElementById(`${sectionName}-section`);
    if (targetSection) {
        targetSection.classList.add('active');
    }

    // Add active class to corresponding nav item
    const activeNavItem = document.querySelector(`[data-section="${sectionName}"]`);
    if (activeNavItem) {
        activeNavItem.classList.add('active');
    }

    // 如果是聊天模块，确保初始化
    if (sectionName === 'chat') {
        console.log('切换到聊天模块');
        // 确保DOM更新完成后初始化
        setTimeout(() => {
            if (typeof initChatModule === 'function') {
                initChatModule();
            } else {
                console.error('initChatModule 函数未定义');
            }
        }, 100);
    }
}


// 以下是原有的所有API Section的JavaScript代码
// 预设的代理地址
const PROXY_URLS = {
    google: 'https://generativelanguage.googleapis.com/v1beta',
    siliconflow: 'https://api.siliconflow.cn/v1',
    openrouter: 'https://api.ppinfra.com/v1',
    volcano: 'https://ark.cn-beijing.volces.com/api/v3',
    custom: ''
};

// 预设的模型列表
const PRESET_MODELS = {
    google: [
        'gemini-2.5-pro',
        'gemini-2.5-flash',
        'gemini-2.5-flash-lite',
        'gemini-2.0-flash'
    ],
    siliconflow: [
        'deepseek-ai/DeepSeek-V3',
        'deepseek-ai/DeepSeek-R1-0528-Qwen3-8B',
        'Qwen/Qwen2-7B-Instruct',
        'Qwen/Qwen2-72B-Instruct'
    ],
    openrouter: [
        'deepseek/deepseek-v3'
    ],
    volcano: [],
    custom: []
};

// 预设的自定义API配置
const CUSTOM_PRESETS = {
    xiaoke: {
        name: '小克全系列',
        url: 'https://api.ibs-gss.top/v1',
        key: 'sk-AzjjyKv0J34Rh3kB1h9xSGSO2IwPDcxmerdxWH1oYZrbdmcu'
    },
    hajimi1: {
        name: '哈基米',
        url: 'https://api.colin1112.dpdns.org/v1',
        key: 'sk-F21i3q3azBvQxnPJcVeRfm7z2dR0g1ti1XfA7yhjSM3WHJWH'
    },
    edu: {
        name: 'EDU站点',
        url: 'https://sdwfger.edu.kg/v1',
        key: 'sk-51qKf6KkiJ5o5ZJLwQx9eb1JMy4JhZQ4dK0ZYaMdXc6YrTnw'
    },
    closeai: {
        name: 'CloseAI',
        url: 'https://api.closeai.im/v1',
        key: 'sk-73PT7Wl6wMMcVUSjjRQI9M6IB2GqYICriViac8CYRUhpkGQs'
    }
};

// 密钥池存储 - 按提供商和模型分类
let keyPools = {};

// 当前使用的密钥索引
let currentKeyIndex = {};

// 初始化
document.addEventListener('DOMContentLoaded', function () {
    const provider = document.getElementById('provider');
    const apiUrl = document.getElementById('apiUrl');
    const temperature = document.getElementById('temperature');
    const tempValue = document.getElementById('tempValue');
    const presetApis = document.getElementById('presetApis');

    // 加载本地存储的密钥池
    loadKeyPools();

    // 切换提供商时自动填充URL
    provider.addEventListener('change', function () {
        if (this.value === 'custom') {
            presetApis.style.display = 'block';
            apiUrl.value = '';
            document.getElementById('apiKey').value = '';
            showMessage('请选择预设API或手动输入自定义API信息', 'info');
        } else {
            presetApis.style.display = 'none';
            if (this.value) {
                apiUrl.value = PROXY_URLS[this.value];
                showMessage(`已自动填充 ${this.options[this.selectedIndex].text} 的代理地址`, 'info');
            }
        }
        updateKeysManager();
    });

    // 温度滑块
    temperature.addEventListener('input', function () {
        tempValue.textContent = this.value;
    });

    // 模型选择变化时更新密钥显示
    document.getElementById('model').addEventListener('change', function () {
        updateKeysDisplay();
    });
});

// 应用预设配置
function applyPreset(presetKey) {
    const preset = CUSTOM_PRESETS[presetKey];
    if (preset) {
        document.getElementById('apiUrl').value = preset.url;
        document.getElementById('apiKey').value = preset.key;
        showMessage(`已应用预设配置: ${preset.name}`, 'success');
        // 自动获取模型
        setTimeout(() => fetchModels(), 500);
    }
}

// 切换密钥可见性
function toggleKeyVisibility() {
    const keyInput = document.getElementById('apiKey');
    const icon = event.target;
    if (keyInput.type === 'password') {
        keyInput.type = 'text';
        icon.textContent = '🙈';
    } else {
        keyInput.type = 'password';
        icon.textContent = '👁️';
    }
}

// 加载密钥池
function loadKeyPools() {
    const saved = localStorage.getItem('aiModelKeyPools');
    if (saved) {
        keyPools = JSON.parse(saved);
    }
}

// 保存密钥池
function saveKeyPools() {
    localStorage.setItem('aiModelKeyPools', JSON.stringify(keyPools));
}

// 更新密钥管理器显示
function updateKeysManager() {
    const provider = document.getElementById('provider').value;
    const keysManager = document.getElementById('keysManager');

    if (provider) {
        keysManager.style.display = 'block';
    } else {
        keysManager.style.display = 'none';
    }
}

// 更新密钥显示
function updateKeysDisplay() {
    const provider = document.getElementById('provider').value;
    const model = document.getElementById('model').value;
    const keysList = document.getElementById('keysList');

    if (!provider || !model) {
        keysList.innerHTML = '<div style="color: #999; font-size: 12px;">请先选择提供商和模型</div>';
        return;
    }

    const poolKey = `${provider}_${model}`;
    const keys = keyPools[poolKey] || [];

    if (keys.length === 0) {
        keysList.innerHTML = '<div style="color: #999; font-size: 12px;">暂无密钥，请添加</div>';
        return;
    }

    keysList.innerHTML = keys.map((key, index) => `
        <div class="key-item">
            <input type="checkbox" ${key.enabled ? 'checked' : ''} onchange="toggleKey('${poolKey}', ${index})">
            <span class="key-text" title="${key.key}">${key.key.substring(0, 20)}...</span>
            <span class="key-status ${key.status}">${key.status === 'active' ? '可用' : key.status === 'failed' ? '失败' : '未测试'}</span>
            <button onclick="removeKey('${poolKey}', ${index})">删除</button>
        </div>
    `).join('');
}

// 添加当前密钥到密钥池
function addCurrentKey() {
    const provider = document.getElementById('provider').value;
    const model = document.getElementById('model').value;
    const apiKey = document.getElementById('apiKey').value;

    if (!provider || !model) {
        showMessage('请先选择提供商和模型', 'error');
        return;
    }

    if (!apiKey) {
        showMessage('请输入API Key', 'error');
        return;
    }

    const poolKey = `${provider}_${model}`;

    if (!keyPools[poolKey]) {
        keyPools[poolKey] = [];
    }

    // 检查是否已存在
    if (keyPools[poolKey].some(k => k.key === apiKey)) {
        showMessage('该密钥已存在', 'warning');
        return;
    }

    keyPools[poolKey].push({
        key: apiKey,
        enabled: true,
        status: 'unused',
        addedTime: new Date().toISOString()
    });

    saveKeyPools();
    updateKeysDisplay();
    showMessage('密钥已添加到密钥池', 'success');
}

// 切换密钥启用状态
function toggleKey(poolKey, index) {
    if (keyPools[poolKey] && keyPools[poolKey][index]) {
        keyPools[poolKey][index].enabled = !keyPools[poolKey][index].enabled;
        saveKeyPools();
    }
}

// 删除密钥
function removeKey(poolKey, index) {
    if (confirm('确定要删除这个密钥吗？')) {
        keyPools[poolKey].splice(index, 1);
        saveKeyPools();
        updateKeysDisplay();
        showMessage('密钥已删除', 'success');
    }
}

// 获取下一个可用密钥
function getNextAvailableKey(provider, model) {
    const poolKey = `${provider}_${model}`;
    const keys = keyPools[poolKey] || [];
    const enabledKeys = keys.filter(k => k.enabled);

    if (enabledKeys.length === 0) {
        return document.getElementById('apiKey').value;
    }

    if (!currentKeyIndex[poolKey]) {
        currentKeyIndex[poolKey] = 0;
    }

    // 轮询到下一个密钥
    const key = enabledKeys[currentKeyIndex[poolKey] % enabledKeys.length];
    currentKeyIndex[poolKey] = (currentKeyIndex[poolKey] + 1) % enabledKeys.length;

    return key.key;
}

// 标记密钥状态
function markKeyStatus(provider, model, apiKey, status) {
    const poolKey = `${provider}_${model}`;
    const keys = keyPools[poolKey] || [];

    const keyObj = keys.find(k => k.key === apiKey);
    if (keyObj) {
        keyObj.status = status;
        saveKeyPools();
        updateKeysDisplay();
    }
}

// 保存配置
function saveConfiguration() {
    const provider = document.getElementById('provider').value;
    const apiUrl = document.getElementById('apiUrl').value;
    const model = document.getElementById('model').value;
    const temperature = document.getElementById('temperature').value;

    if (!provider || !apiUrl) {
        showMessage('请先完成基本配置', 'error');
        return;
    }

    const configName = prompt('请输入配置名称：', `${provider}_${new Date().toLocaleDateString()}`);
    if (!configName) return;

    const config = {
        name: configName,
        provider: provider,
        apiUrl: apiUrl,
        model: model,
        temperature: temperature,
        maxTokens: document.getElementById('maxTokens').value,
        keyPool: keyPools[`${provider}_${model}`] || [],
        savedTime: new Date().toISOString()
    };

    // 保存到localStorage
    let savedConfigs = JSON.parse(localStorage.getItem('aiModelConfigs') || '[]');
    savedConfigs.push(config);
    localStorage.setItem('aiModelConfigs', JSON.stringify(savedConfigs));

    showMessage('配置已保存', 'success');
}

// 加载已保存的配置
function loadSavedConfigs() {
    const savedConfigs = JSON.parse(localStorage.getItem('aiModelConfigs') || '[]');
    const configsList = document.getElementById('configsList');
    const savedConfigsDiv = document.getElementById('savedConfigs');

    if (savedConfigs.length === 0) {
        showMessage('暂无保存的配置', 'info');
        return;
    }

    savedConfigsDiv.style.display = 'block';
    configsList.innerHTML = savedConfigs.map((config, index) => `
        <div class="config-item">
            <span>${config.name} (${new Date(config.savedTime).toLocaleDateString()})</span>
            <div>
                <button class="btn" style="padding: 4px 8px; font-size: 11px; background: #4caf50;" onclick="applyConfig(${index})">应用</button>
                <button class="btn" style="padding: 4px 8px; font-size: 11px; background: #f44336;" onclick="deleteConfig(${index})">删除</button>
            </div>
        </div>
    `).join('');
}

// 应用配置
function applyConfig(index) {
    const savedConfigs = JSON.parse(localStorage.getItem('aiModelConfigs') || '[]');
    const config = savedConfigs[index];

    if (!config) return;

    // 应用配置
    document.getElementById('provider').value = config.provider;
    document.getElementById('apiUrl').value = config.apiUrl;
    document.getElementById('temperature').value = config.temperature;
    document.getElementById('tempValue').textContent = config.temperature;
    document.getElementById('maxTokens').value = config.maxTokens;

    // 恢复密钥池
    const poolKey = `${config.provider}_${config.model}`;
    if (config.keyPool && config.keyPool.length > 0) {
        keyPools[poolKey] = config.keyPool;
        saveKeyPools();
    }

    // 触发获取模型
    fetchModels().then(() => {
        // 设置模型
        if (config.model) {
            document.getElementById('model').value = config.model;
            updateKeysDisplay();
        }
    });

    showMessage(`已应用配置: ${config.name}`, 'success');
    document.getElementById('savedConfigs').style.display = 'none';
}

// 删除配置
function deleteConfig(index) {
    if (confirm('确定要删除这个配置吗？')) {
        let savedConfigs = JSON.parse(localStorage.getItem('aiModelConfigs') || '[]');
        savedConfigs.splice(index, 1);
        localStorage.setItem('aiModelConfigs', JSON.stringify(savedConfigs));
        loadSavedConfigs();
        showMessage('配置已删除', 'success');
    }
}

// 获取模型列表（改进版）
async function fetchModels() {
    const provider = document.getElementById('provider').value;
    const apiUrl = document.getElementById('apiUrl').value;
    const apiKey = document.getElementById('apiKey').value;

    if (!provider) {
        showMessage('请先选择API提供商', 'error');
        return;
    }

    if (!apiUrl) {
        showMessage('请填写API URL', 'error');
        return;
    }

    if (!apiKey) {
        showMessage('请填写API Key', 'error');
        return;
    }

    showMessage('正在获取模型列表...', 'info');

    let models = [];
    let fetchSuccess = false;

    try {
        if (provider === 'google') {
            // Google API
            try {
                const response = await fetch(`${apiUrl}/models?key=${apiKey}`);
                if (response.ok) {
                    const data = await response.json();
                    models = data.models?.map(m => m.name.replace('models/', '')) || [];
                    fetchSuccess = true;
                }
            } catch (e) {
                console.log('Google API请求失败，使用预设列表');
            }
        } else {
            // OpenAI兼容API（包括自定义）
            try {
                // 尝试标准的/models端点
                const response = await fetch(`${apiUrl}/models`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    models = data.data?.map(m => m.id) || [];
                    fetchSuccess = true;
                } else {
                    // 如果失败，尝试使用聊天完成端点测试
                    console.log('标准模型端点失败，尝试其他方法...');

                    // 对于自定义API，提供常见模型列表
                    if (provider === 'custom') {
                        models = await tryFetchCustomModels(apiUrl, apiKey);
                        if (models.length > 0) {
                            fetchSuccess = true;
                        }
                    }
                }
            } catch (e) {
                console.error('获取模型列表错误:', e);

                // 对于自定义API，提供备选方案
                if (provider === 'custom') {
                    models = await tryFetchCustomModels(apiUrl, apiKey);
                    if (models.length > 0) {
                        fetchSuccess = true;
                    }
                }
            }
        }

        // 如果获取失败或为空，使用预设或常见模型
        if (!fetchSuccess || models.length === 0) {
            if (provider === 'custom') {
                // 为自定义API提供常见模型列表
                models = getCommonModels();
                showMessage('无法自动获取模型列表，已加载常见模型供选择', 'warning');
            } else {
                models = PRESET_MODELS[provider] || [];
                if (models.length > 0) {
                    showMessage('使用预设模型列表', 'info');
                }
            }
        }

        // 显示模型选择区域
        displayModels(models);
        updateKeysManager();

        if (models.length > 0) {
            updateStatus(true);
            showMessage(`成功加载 ${models.length} 个模型`, 'success');
        } else {
            showMessage('未找到可用模型', 'warning');
        }

    } catch (error) {
        console.error('Error:', error);
        showMessage('获取模型失败: ' + error.message, 'error');

        // 加载备用模型
        if (provider === 'custom') {
            const models = getCommonModels();
            displayModels(models);
            showMessage('已加载常见模型列表供选择', 'warning');
        }
    }
}

// 尝试获取自定义API的模型
async function tryFetchCustomModels(apiUrl, apiKey) {
    let models = [];

    // 尝试几种不同的端点
    const endpoints = [
        '/models',
        '/v1/models',
        '/api/models'
    ];

    for (const endpoint of endpoints) {
        try {
            const testUrl = apiUrl.replace(/\/v1\/?$/, '') + endpoint;
            const response = await fetch(testUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.data && Array.isArray(data.data)) {
                    models = data.data.map(m => m.id || m.name);
                    if (models.length > 0) break;
                }
            }
        } catch (e) {
            continue;
        }
    }

    // 如果还是没有，返回常见模型
    if (models.length === 0) {
        models = getCommonModels();
    }

    return models;
}

// 获取常见模型列表
function getCommonModels() {
    return [
        // GPT系列
        'gpt-4o',
        'gpt-4o-mini',
        'gpt-4-turbo',
        'gpt-4',
        'gpt-3.5-turbo',
        'gpt-3.5-turbo-16k',
        // Claude系列
        'claude-3-5-sonnet-20241022',
        'claude-3-5-haiku-20241022',
        'claude-3-opus-20240229',
        'claude-3-sonnet-20240229',
        'claude-3-haiku-20240307',
        // DeepSeek系列
        'deepseek-chat',
        'deepseek-coder',
        // Gemini系列
        'gemini-pro',
        'gemini-1.5-pro',
        'gemini-1.5-flash',
        // 其他
        'mixtral-8x7b-instruct',
        'llama-3.1-70b-versatile',
        'qwen-turbo',
        'qwen-plus'
    ];
}

// 显示模型列表
function displayModels(models) {
    const modelContainer = document.getElementById('modelContainer');
    const modelSelect = document.getElementById('model');
    const modelChips = document.getElementById('modelChips');

    modelContainer.style.display = 'block';
    modelSelect.innerHTML = '<option value="">请选择模型</option>';
    modelChips.innerHTML = '';

    models.forEach(model => {
        // 添加到下拉列表
        const option = document.createElement('option');
        option.value = model;
        option.textContent = model;
        modelSelect.appendChild(option);

        // 添加快速选择按钮（只显示前8个）
        if (modelChips.children.length < 8) {
            const chip = document.createElement('div');
            chip.className = 'model-chip';
            chip.textContent = model.split('/').pop().substring(0, 20);
            chip.title = model;
            chip.onclick = function () {
                modelSelect.value = model;
                document.querySelectorAll('.model-chip').forEach(c => c.classList.remove('selected'));
                this.classList.add('selected');
                updateKeysDisplay();
            };
            modelChips.appendChild(chip);
        }
    });
}

// 测试连接
async function testConnection() {
    const provider = document.getElementById('provider').value;
    const apiUrl = document.getElementById('apiUrl').value;
    const model = document.getElementById('model').value;

    if (!apiUrl) {
        showMessage('请先完成API配置', 'error');
        return;
    }

    if (!model) {
        showMessage('请选择一个模型', 'error');
        return;
    }

    // 获取可用密钥
    const apiKey = document.getElementById('enableKeyRotation').checked
        ? getNextAvailableKey(provider, model)
        : document.getElementById('apiKey').value;

    if (!apiKey) {
        showMessage('请配置API Key', 'error');
        return;
    }

    showMessage('正在测试连接...', 'info');

    try {
        let response;

        if (provider === 'google') {
            response = await fetch(`${apiUrl}/models/${model}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: 'Hi' }] }],
                    generationConfig: { maxOutputTokens: 10 }
                })
            });
        } else {
            // OpenAI兼容格式（包括自定义）
            response = await fetch(`${apiUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: model,
                    messages: [{ role: 'user', content: 'Hi' }],
                    max_tokens: 10,
                    stream: false
                })
            });
        }

        if (response.ok) {
            updateStatus(true);
            markKeyStatus(provider, model, apiKey, 'active');
            showMessage('连接成功！', 'success');
        } else {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 100)}`);
        }
    } catch (error) {
        updateStatus(false);
        markKeyStatus(provider, model, apiKey, 'failed');
        showMessage('连接失败：' + error.message, 'error');
        console.error('连接测试失败:', error);
    }
}

// 发送消息（支持密钥轮询）
async function sendMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();

    if (!message) return;

    const provider = document.getElementById('provider').value;
    const apiUrl = document.getElementById('apiUrl').value;
    const model = document.getElementById('model').value;
    const temperature = parseFloat(document.getElementById('temperature').value);
    const maxTokens = parseInt(document.getElementById('maxTokens').value);

    if (!apiUrl || !model) {
        showMessage('请先完成API配置', 'error');
        return;
    }

    // 添加用户消息
    addMessage('user', message);
    input.value = '';

    // 添加加载消息
    const loadingId = addMessage('assistant', '<div class="loading"></div>');

    // 尝试发送消息，支持密钥轮询
    const enableRotation = document.getElementById('enableKeyRotation').checked;
    let success = false;
    let lastError = null;

    if (enableRotation) {
        const poolKey = `${provider}_${model}`;
        const keys = (keyPools[poolKey] || []).filter(k => k.enabled);

        if (keys.length === 0) {
            // 没有密钥池，使用当前密钥
            const apiKey = document.getElementById('apiKey').value;
            if (apiKey) {
                success = await trySendMessage(provider, apiUrl, apiKey, model, message, temperature, maxTokens, loadingId);
            }
        } else {
            // 轮询密钥
            for (let i = 0; i < keys.length; i++) {
                const key = keys[i];
                success = await trySendMessage(provider, apiUrl, key.key, model, message, temperature, maxTokens, loadingId);

                if (success) {
                    markKeyStatus(provider, model, key.key, 'active');
                    break;
                } else {
                    markKeyStatus(provider, model, key.key, 'failed');
                }
            }
        }
    } else {
        // 不使用轮询，只用当前密钥
        const apiKey = document.getElementById('apiKey').value;
        if (apiKey) {
            success = await trySendMessage(provider, apiUrl, apiKey, model, message, temperature, maxTokens, loadingId);
        }
    }

    if (!success) {
        updateMessage(loadingId, '❌ 所有密钥都失败了，请检查配置');
    }
}

// 尝试发送消息
async function trySendMessage(provider, apiUrl, apiKey, model, message, temperature, maxTokens, loadingId) {
    try {
        let response;
        let reply = '';

        if (provider === 'google') {
            response = await fetch(`${apiUrl}/models/${model}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: message }] }],
                    generationConfig: {
                        temperature: temperature,
                        maxOutputTokens: maxTokens
                    }
                })
            });

            if (response.ok) {
                const data = await response.json();
                reply = data.candidates?.[0]?.content?.parts?.[0]?.text || '无响应';
            } else {
                return false;
            }

        } else {
            // OpenAI兼容格式（包括自定义）
            response = await fetch(`${apiUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: model,
                    messages: [{ role: 'user', content: message }],
                    temperature: temperature,
                    max_tokens: maxTokens,
                    stream: false
                })
            });

            if (response.ok) {
                const data = await response.json();
                reply = data.choices?.[0]?.message?.content || data.message || '无响应';
            } else {
                return false;
            }
        }

        updateMessage(loadingId, reply);
        return true;

    } catch (error) {
        console.error('发送消息失败:', error);
        return false;
    }
}

// 添加消息
function addMessage(role, content) {
    const messagesDiv = document.getElementById('chatMessages');
    const messageId = 'msg-' + Date.now();

    // 清除初始提示
    if (messagesDiv.children.length === 1 && messagesDiv.children[0].style.textAlign === 'center') {
        messagesDiv.innerHTML = '';
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role === 'user' ? 'user-message' : 'ai-message'}`;
    messageDiv.id = messageId;
    messageDiv.innerHTML = content;

    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    return messageId;
}

// 更新消息
function updateMessage(messageId, content) {
    const messageDiv = document.getElementById(messageId);
    if (messageDiv) {
        messageDiv.innerHTML = content;
    }
}

// 处理回车键
function handleKeyPress(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        sendMessage();
    }
}

// 更新状态
function updateStatus(connected) {
    const dot = document.getElementById('statusDot');
    const text = document.getElementById('statusText');

    if (connected) {
        dot.className = 'status-dot status-connected';
        text.textContent = '已连接';
    } else {
        dot.className = 'status-dot status-disconnected';
        text.textContent = '未连接';
    }
}

// 显示消息
function showMessage(message, type) {
    const messageArea = document.getElementById('messageArea');
    messageArea.className = `message-area ${type}-message`;
    messageArea.textContent = message;
    messageArea.style.display = 'block';

    // 自动隐藏非信息类消息
    if (type !== 'info') {
        setTimeout(() => {
            messageArea.style.display = 'none';
        }, 5000);
    } else {
        // 信息类消息3秒后隐藏
        setTimeout(() => {
            messageArea.style.display = 'none';
        }, 3000);
    }
}

// 折叠测试区域
function toggleTestSection() {
    const content = document.getElementById('testContent');
    const arrow = document.getElementById('collapseArrow');

    if (content.style.maxHeight) {
        content.style.maxHeight = null;
        arrow.classList.remove('collapsed');
    } else {
        content.style.maxHeight = content.scrollHeight + "px";
        arrow.classList.add('collapsed');
    }
}



// ==================== 聊天模块核心代码 ====================

// 全局变量
let currentChatId = null; // 当前聊天对象ID
let currentChatType = 'friend'; // 当前聊天类型: friend/group
let chatHistory = {}; // 聊天记录存储
let contacts = []; // 联系人列表
let groups = []; // 群组列表
let aiReplyTimer = null; // AI自动回复定时器
let aiActiveTimer = null; // AI主动发消息定时器
let chatModuleInitialized = false; // 添加这行：聊天模块初始化标志


// 新增 个人板块
// ==================== 个人设置集成 ====================
// 在 AIManager 对象定义之前添加
let currentUserPersona = null; // 当前用户人设

// 加载用户人设
function loadUserPersona() {
    const saved = localStorage.getItem('currentUserPersona');
    if (saved) {
        currentUserPersona = JSON.parse(saved);
    }
}







function initChatModule() {
    // 防止重复初始化
    if (chatModuleInitialized) {
        console.log('聊天模块已初始化，跳过');
        return;
    }

    console.log('开始初始化聊天模块');

    // 加载保存的数据
    loadChatData();

    // 验证数据完整性
    validateAndRepairChatData();

    // 确保至少有默认联系人
    ensureDefaultContacts();

    // 绑定事件监听器
    bindChatEvents();

    // 启动AI主动消息
    startAIActiveMessages();

    // 更新联系人列表显示
    updateContactsList();

    // 移动端默认显示列表视图
    if (window.innerWidth <= 768) {
        const listView = document.getElementById('chatListView');
        const conversationView = document.getElementById('chatConversationView');
        if (listView) listView.style.display = 'flex';
        if (conversationView) conversationView.style.display = 'none';
    }

    // 标记为已初始化
    chatModuleInitialized = true;
    console.log('聊天模块初始化完成');
}  // ← 确保这里有闭合括号
// 新增：确保默认联系人存在


// AI主动发送消息功能
function startAIActiveMessages() {
    // 这个函数可以为空或添加你需要的逻辑
    console.log('AI主动消息功能已启动');
}






// 在 AIManager 对象中添加以下方法
AIManager.roleManager = AIManager.roleManager || {
    // 更新角色记忆
    updateRoleMemory: function(roleId, data) {
        const knowledgeKey = `ai_knowledge_${roleId}`;
        let knowledge = JSON.parse(localStorage.getItem(knowledgeKey) || '{}');
        
        // 合并新数据
        Object.assign(knowledge, data);
        
        // 保存更新
        localStorage.setItem(knowledgeKey, JSON.stringify(knowledge));
        
        // 通知角色系统更新
        if (window.contacts) {
            const contact = window.contacts.find(c => c.id === roleId);
            if (contact) {
                contact.knowledge = knowledge;
            }
        }
    },
    
    // 获取角色知识
    getRoleKnowledge: function(roleId) {
        const knowledgeKey = `ai_knowledge_${roleId}`;
        return JSON.parse(localStorage.getItem(knowledgeKey) || '{}');
    }
};




// 在聊天消息生成时，添加人设和日历知识的考虑
window.generateAIResponse = function(message, contactId) {
    const knowledge = AIManager.roleManager.getRoleKnowledge(contactId);
    
    // 构建包含人设和日历信息的提示
    let prompt = message;
    
    if (knowledge.userPersona) {
        prompt = `用户信息：${knowledge.userPersona.name}，${knowledge.userPersona.gender}，${knowledge.userPersona.background}。\n` + prompt;
    }
    
    if (knowledge.calendarEvents && knowledge.calendarEvents.length > 0) {
        const recentEvents = knowledge.calendarEvents.slice(-5);
        prompt += `\n最近的日历事件：${recentEvents.map(e => e.content).join(', ')}`;
    }
    
    // 继续原有的AI响应生成逻辑...
};










function ensureDefaultContacts() {
    // 只在完全没有任何联系人时添加默认AI助手
    if (contacts.length === 0 && groups.length === 0) {
        console.log('添加默认AI助手');
        addDefaultContacts();
    }
}


// 加载聊天数据
// 加载聊天数据 - 替换原有函数
function loadChatData() {
    try {
        const savedContacts = localStorage.getItem('chatContacts');
        const savedGroups = localStorage.getItem('chatGroups');
        const savedHistory = localStorage.getItem('chatHistory');

        // 加载联系人
        if (savedContacts) {
            const parsedContacts = JSON.parse(savedContacts);
            if (Array.isArray(parsedContacts)) {
                contacts = parsedContacts;
                console.log(`加载了 ${contacts.length} 个联系人`);
            }
        }

        // 加载群组
        if (savedGroups) {
            const parsedGroups = JSON.parse(savedGroups);
            if (Array.isArray(parsedGroups)) {
                groups = parsedGroups;
                console.log(`加载了 ${groups.length} 个群组`);
            }
        }

        // 加载聊天历史
        if (savedHistory) {
            const parsedHistory = JSON.parse(savedHistory);
            if (typeof parsedHistory === 'object') {
                chatHistory = parsedHistory;
                console.log('聊天历史加载成功');
            }
        }
    } catch (error) {
        console.error('加载聊天数据失败:', error);
        // 如果加载失败，初始化为空数组/对象
        contacts = contacts || [];
        groups = groups || [];
        chatHistory = chatHistory || {};
    }
}

// 保存聊天数据
function saveChatData() {
    localStorage.setItem('chatContacts', JSON.stringify(contacts));
    localStorage.setItem('chatGroups', JSON.stringify(groups));
    localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
}
// 验证并修复数据完整性
function validateAndRepairChatData() {
    let needsSave = false;

    // 确保数组和对象正确初始化
    if (!Array.isArray(contacts)) {
        console.warn('修复：contacts 不是数组，重置为空数组');
        contacts = [];
        needsSave = true;
    }

    if (!Array.isArray(groups)) {
        console.warn('修复：groups 不是数组，重置为空数组');
        groups = [];
        needsSave = true;
    }

    if (typeof chatHistory !== 'object' || chatHistory === null) {
        console.warn('修复：chatHistory 不是对象，重置为空对象');
        chatHistory = {};
        needsSave = true;
    }

    // 如果没有任何联系人和群组，添加默认联系人
    if (contacts.length === 0 && groups.length === 0) {
        console.log('没有联系人，添加默认AI助手');
        addDefaultContacts();
        needsSave = true;
    }

    if (needsSave) {
        saveChatData();
    }
}


// 添加默认联系人
function addDefaultContacts() {
    contacts = [
        {
            id: 'ai_assistant',
            name: 'AI助手',
            avatar: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Ccircle cx="50" cy="50" r="50" fill="%23667eea"/%3E%3Ctext x="50" y="55" text-anchor="middle" fill="white" font-size="40"%3EA%3C/text%3E%3C/svg%3E',
            status: 'online',
            lastMessage: '点击开始聊天',
            lastTime: '刚刚',
            unread: 1,
            background: '我是您的AI助手，可以陪您聊天、解答问题、提供建议。',
            gender: 'other'
        }
    ];
    saveChatData();
}

// 绑定事件监听器
function bindChatEvents() {
    // 搜索功能
    const searchInput = document.getElementById('searchContact');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchContacts(e.target.value);
        });
    }

    // 输入框自动调整高度
    const chatInput = document.getElementById('chatInputField');
    if (chatInput) {
        chatInput.addEventListener('input', function () {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 120) + 'px';
        });

        // 支持Ctrl+Enter发送
        chatInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && e.ctrlKey) {
                sendChatMessage();
            }
        });
    }
}



// ==================== 联系人管理功能 ====================
// 置顶功能相关函数
function togglePin(contactId, event) {
    // 阻止事件冒泡，避免触发选择联系人
    event.stopPropagation();

    // 查找联系人
    let contact = contacts.find(c => c.id === contactId) ||
        groups.find(g => g.id === contactId);

    if (!contact) return;

    // 检查已置顶数量
    const allContacts = [...contacts, ...groups];
    const pinnedCount = allContacts.filter(c => c.pinned).length;

    if (!contact.pinned && pinnedCount >= 6) {
        alert('最多只能置顶6个联系人');
        return;
    }

    // 切换置顶状态
    contact.pinned = !contact.pinned;
    contact.pinnedTime = contact.pinned ? Date.now() : null;

    // 保存数据
    saveChatData();

    // 更新显示
    updateContactsList();
}

// 获取排序后的联系人列表
function getSortedContacts() {
    const allContacts = [...contacts, ...groups];

    // 分离置顶和非置顶联系人
    const pinnedContacts = allContacts.filter(c => c.pinned);
    const unpinnedContacts = allContacts.filter(c => !c.pinned);

    // 置顶联系人按置顶时间排序（最新置顶的在前）
    pinnedContacts.sort((a, b) => (b.pinnedTime || 0) - (a.pinnedTime || 0));

    // 非置顶联系人按最后消息时间排序
    unpinnedContacts.sort((a, b) => {
        const timeA = a.lastTime ? new Date(a.lastTime).getTime() : 0;
        const timeB = b.lastTime ? new Date(b.lastTime).getTime() : 0;
        return timeB - timeA;
    });

    // 合并返回
    return [...pinnedContacts, ...unpinnedContacts];
}
// 选择联系人
function selectContact(element, contactId) {
    // 移除所有active类
    document.querySelectorAll('.contact-item').forEach(item => {
        item.classList.remove('active');
    });

    // 添加active类到当前元素
    if (element) {
        element.classList.add('active');
    }

    // 设置当前聊天
    currentChatId = contactId;

    // 查找联系人信息
    let contact = contacts.find(c => c.id === contactId) ||
        groups.find(g => g.id === contactId);

    if (contact) {
        currentChatType = groups.find(g => g.id === contactId) ? 'group' : 'friend';

        // 更新聊天头部信息
        updateChatHeader(contact);

        // 加载聊天记录
        loadChatHistory(contactId);

        // 清除未读消息
        contact.unread = 0;
        updateContactsList();
        saveChatData();

        // 显示聊天界面
        showChatConversation();
    }
}
// 显示聊天对话界面   新增
function showChatConversation() {
    const listView = document.getElementById('chatListView');
    const conversationView = document.getElementById('chatConversationView');

    if (window.innerWidth <= 768) {
        // 移动端：隐藏列表，显示聊天
        if (listView) listView.style.display = 'none';
        if (conversationView) conversationView.style.display = 'flex';
    } else {
        // 桌面端：两者都显示
        if (conversationView) conversationView.style.display = 'flex';
    }

    // 滚动到底部
    setTimeout(() => {
        const container = document.getElementById('chatMessagesContainer');
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }, 100);
}
// 返回联系人列表 新增
function backToList() {
    const listView = document.getElementById('chatListView');
    const conversationView = document.getElementById('chatConversationView');

    if (listView) listView.style.display = 'flex';
    if (conversationView) conversationView.style.display = 'none';

    // 关闭下拉菜单
    const dropdownMenu = document.getElementById('chatDropdownMenu');
    if (dropdownMenu) dropdownMenu.style.display = 'none';
}

// 切换聊天菜单 新增
function toggleChatMenu() {
    const menu = document.getElementById('chatDropdownMenu');
    if (menu) {
        menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    }

    // 点击其他地方关闭菜单
    document.addEventListener('click', function closeMenu(e) {
        if (!e.target.closest('.chat-more-btn') && !e.target.closest('.chat-dropdown-menu')) {
            if (menu) menu.style.display = 'none';
            document.removeEventListener('click', closeMenu);
        }
    });
}




// 更新聊天头部 更新
function updateChatHeader(contact) {
    const headerName = document.getElementById('chatTargetName');
    const headerStatus = document.getElementById('chatTargetStatus');
    const headerAvatar = document.getElementById('chatTargetAvatar');

    if (headerName) headerName.textContent = contact.name;
    if (headerStatus) headerStatus.textContent = contact.status === 'online' ? '在线' : '离线';
    if (headerAvatar) headerAvatar.src = contact.avatar;
}


// 加载聊天记录
function loadChatHistory(contactId) {
    const messagesContainer = document.getElementById('chatMessagesContainer');
    if (!messagesContainer) return;

    const history = chatHistory[contactId] || [];

    if (history.length === 0) {
        messagesContainer.innerHTML = `
    <div class="chat-welcome-message">
        <div class="welcome-icon">💬</div>
        <div class="welcome-text">开始新的对话</div>
    </div>
`;
    } else {
        messagesContainer.innerHTML = '';
        history.forEach(msg => {
            addMessageToUI(msg.sender, msg.content, msg.time, false);
        });
    }

    // 滚动到底部
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// 更新联系人列表 更新
// 更新联系人列表
function updateContactsList() {
    const contactList = document.getElementById('contactList');
    if (!contactList) return;

    const sortedContacts = getSortedContacts();

    contactList.innerHTML = sortedContacts.map((contact, index) => `
<div class="contact-item ${contact.id === currentChatId ? 'active' : ''} ${contact.pinned ? 'pinned' : ''}" 
     onclick="selectContact(this, '${contact.id}')">
    ${contact.pinned ? `<span class="pinned-badge">置顶</span>` : ''}
    <div class="contact-avatar">
        <img src="${contact.avatar}" alt="avatar">
        ${contact.status === 'online' ? '<span class="online-status"></span>' : ''}
    </div>
    <div class="contact-info">
        <div class="contact-name">${contact.name}</div>
        <div class="contact-message">${contact.lastMessage || '暂无消息'}</div>
    </div>
    <div class="contact-meta">
        <div class="contact-time">${contact.lastTime || ''}</div>
        ${contact.unread > 0 ? `<div class="unread-badge">${contact.unread}</div>` : ''}
    </div>
    <button class="pin-button ${contact.pinned ? 'pinned' : ''}" 
            onclick="togglePin('${contact.id}', event)" 
            title="${contact.pinned ? '取消置顶' : '置顶'}">
        📌
    </button>
</div>
`).join('');
}

// 搜索联系人
function searchContacts(keyword) {
    const allContacts = [...contacts, ...groups];
    const filtered = allContacts.filter(c =>
        c.name.toLowerCase().includes(keyword.toLowerCase())
    );

    const contactList = document.getElementById('contactList');
    if (!contactList) return;

    contactList.innerHTML = filtered.map(contact => `
<div class="contact-item" onclick="selectContact(this, '${contact.id}')">
    <div class="contact-avatar">
        <img src="${contact.avatar}" alt="avatar">
        ${contact.status === 'online' ? '<span class="online-status"></span>' : ''}
    </div>
    <div class="contact-info">
        <div class="contact-name">${contact.name}</div>
        <div class="contact-message">${contact.lastMessage || '暂无消息'}</div>
    </div>
</div>
`).join('');
}

// ==================== 消息发送与接收 ====================

// 发送消息
function sendChatMessage() {
    const input = document.getElementById('chatInputField');
    const message = input.value.trim();

    if (!message || !currentChatId) return;

    // 添加消息到UI
    addMessageToUI('user', message, new Date().toLocaleTimeString(), true);

    // 保存到历史记录
    saveMessageToHistory(currentChatId, 'user', message);

    // 清空输入框
    input.value = '';
    input.style.height = 'auto';

    // 更新联系人最后消息
    updateContactLastMessage(currentChatId, message);





    // 新增 个人板块
    // 在 sendChatMessage 函数中，在 "// 触发AI回复" 之前添加
    // 处理用户发送的交易
    const userTransferMatch = message.match(/转账.*?([0-9.]+)/);
    const userRedPacketMatch = message.match(/红包.*?\[¥([0-9.]+)\]/);
    const userGiftMatch = message.match(/送了.*?(玫瑰|蛋糕|钻石|跑车|飞机)/);

    if (userTransferMatch) {
        const amount = parseFloat(userTransferMatch[1]);
        if (window.PersonalModule) {
            window.PersonalModule.addTransaction('expense', amount, `转账给${contact.name}`, currentChatId);
        }
    } else if (userRedPacketMatch) {
        const amount = parseFloat(userRedPacketMatch[1]);
        if (window.PersonalModule) {
            window.PersonalModule.addTransaction('expense', amount, `发红包给${contact.name}`, currentChatId);
        }
    } else if (userGiftMatch) {
        const giftPrices = {
            '玫瑰': 10,
            '蛋糕': 50,
            '钻石': 100,
            '跑车': 500,
            '飞机': 1000
        };
        const gift = userGiftMatch[1];
        const amount = giftPrices[gift] || 0;
        if (amount > 0 && window.PersonalModule) {
            window.PersonalModule.addTransaction('expense', amount, `送出礼物：${gift}给${contact.name}`, currentChatId);
        }
    }





    // 触发AI回复
    if (currentChatType === 'friend') {
        triggerAIReply(message);
    } else {
        // 群聊中随机触发成员回复
        setTimeout(() => triggerGroupReply(message), 1000 + Math.random() * 2000);
    }
}

// 添加消息到UI
// 添加消息到UI
// 添加消息到UI
// 添加消息到UI
function addMessageToUI(sender, content, time, animate = true) {
    const messagesContainer = document.getElementById('chatMessagesContainer');
    if (!messagesContainer) return;

    // 清除欢迎消息
    const welcomeMsg = messagesContainer.querySelector('.chat-welcome-message');
    if (welcomeMsg) welcomeMsg.remove();

    // 获取发送者信息
    let senderName = '我';
    let senderAvatar = localStorage.getItem('userAvatar') || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Ccircle cx="50" cy="50" r="50" fill="%234CAF50"/%3E%3Ctext x="50" y="55" text-anchor="middle" fill="white" font-size="40"%3E我%3C/text%3E%3C/svg%3E';

    if (sender !== 'user') {
        const contact = contacts.find(c => c.id === currentChatId) ||
            groups.find(g => g.id === currentChatId);
        if (contact) {
            senderName = contact.name;
            senderAvatar = contact.avatar;
        }
    }
    // 新增 个人板块
    // 在 addMessageToUI 函数调用之后，添加交易处理
    // 找到 addMessageToUI 的调用位置，在其后添加
    if (sender !== 'user') {
        processAITransaction(content, currentChatId);
    }







    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message message-${sender === 'user' ? 'sent' : 'received'}`;
    if (animate) messageDiv.style.animation = 'messageSlide 0.3s ease';

    messageDiv.innerHTML = `
<div class="message-avatar">
    <img src="${senderAvatar}" alt="${senderName}">
</div>
<div class="message-content-wrapper">
    <div class="message-sender-name">${senderName}</div>
    <div class="message-bubble">
        ${content}
        <div class="message-time" style="font-size: 10px; opacity: 0.7; margin-top: 4px;">
            ${time || new Date().toLocaleTimeString()}
        </div>
    </div>
</div>
`;

    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// 保存消息到历史记录
// 保存消息到历史记录
function saveMessageToHistory(contactId, sender, content) {
    if (!chatHistory[contactId]) {
        chatHistory[contactId] = [];
    }

    const now = new Date();
    chatHistory[contactId].push({
        sender: sender,
        content: content,
        time: now.toLocaleTimeString(),
        timestamp: now.toISOString(), // 添加ISO格式时间戳
        date: now.toLocaleDateString() // 添加日期
    });

    // 限制历史记录数量
    if (chatHistory[contactId].length > 100) {
        chatHistory[contactId] = chatHistory[contactId].slice(-100);
    }

    saveChatData();
}

// 更新联系人最后消息
function updateContactLastMessage(contactId, message) {
    const contact = contacts.find(c => c.id === contactId) ||
        groups.find(g => g.id === contactId);

    if (contact) {
        contact.lastMessage = message.substring(0, 30) + (message.length > 30 ? '...' : '');
        contact.lastTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        updateContactsList();
        saveChatData();
    }
}



// ==================== AI功能 ====================

// ==================== 增强AI系统核心模块 ====================

// ==================== 增强AI系统核心模块 ====================

// 全局配置
const AI_CONFIG = {
    MESSAGE_SPLIT_COUNT: { min: 6, max: 10 },
    NARRATION_COUNT: { min: 1, max: 2 },
    NARRATION_LENGTH: { min: 30, max: 120 },
    GROUP_REPLY_DELAY: { min: 500, max: 2000 },
    TYPING_DURATION: { min: 1000, max: 3000 },
    MEMORY_CONTEXT_SIZE: 20,
    BEIJING_TIMEZONE: 'Asia/Shanghai'
};

// 角色记忆池 - 跨场景共享
const CharacterMemoryPool = {
    memories: {},

    init(characterId) {
        if (!this.memories[characterId]) {
            this.memories[characterId] = {
                shortTerm: [],
                longTerm: [],
                lastInteraction: null,
                emotionalState: 'neutral',
                topics: []
            };
        }
    },

    addMemory(characterId, memory) {
        this.init(characterId);
        this.memories[characterId].shortTerm.push({
            content: memory,
            timestamp: new Date().toISOString(),
            scene: getCurrentScene()
        });

        if (this.memories[characterId].shortTerm.length > AI_CONFIG.MEMORY_CONTEXT_SIZE) {
            const important = this.memories[characterId].shortTerm.shift();
            this.memories[characterId].longTerm.push(important);
        }

        this.save();
    },

    getRelevantMemories(characterId, context) {
        this.init(characterId);
        const mem = this.memories[characterId];
        return {
            recent: mem.shortTerm.slice(-10),
            important: mem.longTerm.slice(-5),
            lastInteraction: mem.lastInteraction,
            emotionalState: mem.emotionalState
        };
    },

    save() {
        localStorage.setItem('characterMemoryPool', JSON.stringify(this.memories));
    },

    load() {
        const saved = localStorage.getItem('characterMemoryPool');
        if (saved) {
            this.memories = JSON.parse(saved);
        }
    }
};

// 获取当前北京时间
function getBeijingTime() {
    const now = new Date();
    const beijingTime = new Date(now.toLocaleString("en-US", { timeZone: AI_CONFIG.BEIJING_TIMEZONE }));
    return {
        full: beijingTime,
        time: beijingTime.toTimeString().slice(0, 5),
        date: beijingTime.toLocaleDateString('zh-CN'),
        hour: beijingTime.getHours(),
        dayOfWeek: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][beijingTime.getDay()]
    };
}

// 获取当前场景类型
function getCurrentScene() {
    if (currentChatType === 'group') return 'group_chat';
    if (currentChatType === 'friend') return 'private_chat';
    return 'unknown';
}

// ==================== 旁白生成系统 ====================

class NarrationGenerator {
    constructor() {
        this.lastNarrationTime = 0;
        this.narrationInterval = 3;
        this.messageCount = 0;
    }

    shouldGenerateNarration() {
        this.messageCount++;
        if (this.messageCount >= this.narrationInterval) {
            this.messageCount = 0;
            return true;
        }
        return Math.random() > 0.7;
    }

    async generateNarration(context, character) {
        const timeInfo = getBeijingTime();
        const prompt = `
场景：${getCurrentScene()}
时间：${timeInfo.dayOfWeek} ${timeInfo.time}
角色：${character.name}
最近对话：${context}

生成一段简短的旁白，要求：
1. 必须是完整的句子，有开头有结尾
2. 控制在30-80字之间
3. 描述场景氛围、角色动作或心理活动
4. 不要使用第一人称
5. 确保句子自然结束，不要用省略号结尾（除非特意表达停顿）
`;

        const narration = await this.callAIForNarration(prompt, character);
        return this.processNarration(narration);
    }

    async callAIForNarration(prompt, character) {
        try {
            const provider = document.getElementById('provider')?.value;
            const apiUrl = document.getElementById('apiUrl')?.value;
            const apiKey = document.getElementById('apiKey')?.value;
            const model = document.getElementById('model')?.value;

            if (!apiUrl || !apiKey || !model) {
                return this.getFallbackNarration(character);
            }

            let response;
            if (provider === 'google') {
                response = await fetch(`${apiUrl}/models/${model}:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: {
                            temperature: 0.8,
                            maxOutputTokens: 100
                        }
                    })
                });
            } else {
                response = await fetch(`${apiUrl}/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: model,
                        messages: [
                            { role: 'system', content: '你是一个优秀的小说旁白生成器。' },
                            { role: 'user', content: prompt }
                        ],
                        temperature: 0.8,
                        max_tokens: 100
                    })
                });
            }

            if (response.ok) {
                const data = await response.json();
                if (provider === 'google') {
                    return data.candidates?.[0]?.content?.parts?.[0]?.text || this.getFallbackNarration(character);
                } else {
                    return data.choices?.[0]?.message?.content || this.getFallbackNarration(character);
                }
            }
        } catch (error) {
            console.error('旁白生成失败:', error);
        }

        return this.getFallbackNarration(character);
    }

    getFallbackNarration(character) {
        const narrations = [
            `${character.name}停顿了一下，似乎在思考着什么。`,
            `房间里安静了片刻，只有轻微的呼吸声。`,
            `${character.name}的表情变得柔和起来。`,
            `窗外的光线洒进来，照在两人之间。`,
            `时间仿佛在这一刻慢了下来。`
        ];
        return narrations[Math.floor(Math.random() * narrations.length)];
    }

    formatNarration(text) {
        return text.trim();
    }

    processNarration(text) {
        return this.formatNarration(text);
    }

    insertNarration(text) {
        const messagesContainer = document.getElementById('chatMessagesContainer');
        if (!messagesContainer) return;

        const narrationDiv = document.createElement('div');
        narrationDiv.className = 'chat-narration';
        narrationDiv.textContent = text;

        messagesContainer.appendChild(narrationDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

// ==================== 消息分割系统 ====================

class MessageSplitter {
    splitMessage(text, minCount = 6, maxCount = 10) {
        let sentences = text.match(/[^。！？.!?]+[。！？.!?]+/g) || [text];

        if (sentences.length < minCount) {
            const newSentences = [];
            sentences.forEach(sentence => {
                const parts = sentence.split(/[，,]/);
                if (parts.length > 1) {
                    parts.forEach((part, index) => {
                        if (index < parts.length - 1) {
                            newSentences.push(part + '，');
                        } else {
                            newSentences.push(part);
                        }
                    });
                } else {
                    newSentences.push(sentence);
                }
            });
            sentences = newSentences;
        }

        const messages = [];
        let currentMessage = '';

        sentences.forEach(sentence => {
            if (currentMessage.length + sentence.length < 30) {
                currentMessage += sentence;
            } else {
                if (currentMessage) messages.push(currentMessage);
                currentMessage = sentence;
            }
        });

        if (currentMessage) messages.push(currentMessage);

        while (messages.length > maxCount) {
            let minIndex = 0;
            let minLength = messages[0].length + messages[1].length;

            for (let i = 1; i < messages.length - 1; i++) {
                const combinedLength = messages[i].length + messages[i + 1].length;
                if (combinedLength < minLength) {
                    minLength = combinedLength;
                    minIndex = i;
                }
            }

            messages[minIndex] = messages[minIndex] + messages[minIndex + 1];
            messages.splice(minIndex + 1, 1);
        }

        return messages;
    }
}

// ==================== 群聊编排系统 ====================

class GroupChatOrchestrator {
    constructor() {
        this.messageSplitter = new MessageSplitter();
    }

    async generateGroupReplies(userMessage, group) {
        const members = this.getActiveMembers(group);
        const replySequence = [];
        const timeInfo = getBeijingTime();

        const activeMembers = members.filter(member => {
            if (member.schedule) {
                const currentHour = timeInfo.hour;
                if (member.schedule.sleepTime && currentHour >= member.schedule.sleepTime) {
                    return false;
                }
                if (member.schedule.wakeTime && currentHour < member.schedule.wakeTime) {
                    return false;
                }
            }
            return true;
        });

        if (activeMembers.length === 0) {
            return [{
                sender: 'system',
                content: '（群里现在没有人在线）',
                type: 'system'
            }];
        }

        const respondingMembers = this.selectRespondingMembers(activeMembers, userMessage);

        for (const member of respondingMembers) {
            const replies = await this.generateMemberReplies(member, userMessage, replySequence);

            replies.forEach((reply, index) => {
                const insertPosition = this.calculateInsertPosition(replySequence, member, index);
                replySequence.splice(insertPosition, 0, {
                    sender: member.name,
                    avatar: member.avatar,
                    content: reply,
                    delay: this.calculateDelay(insertPosition)
                });
            });
        }

        return replySequence;
    }

    selectRespondingMembers(members, message) {
        const respondingMembers = [];

        members.forEach(member => {
            let probability = 0.5;

            if (message.includes(`@${member.name}`)) {
                probability = 0.95;
            }

            if (member.personality === 'active') probability += 0.2;
            if (member.personality === 'quiet') probability -= 0.2;

            if (Math.random() < probability) {
                respondingMembers.push(member);
            }
        });

        if (respondingMembers.length === 0 && members.length > 0) {
            respondingMembers.push(members[Math.floor(Math.random() * members.length)]);
        }

        return respondingMembers;
    }

    async generateMemberReplies(member, userMessage, context) {
        const replyCount = Math.floor(Math.random() * 3) + 1;
        const replies = [];

        for (let i = 0; i < replyCount; i++) {
            const reply = await this.callAIForGroupReply(member, userMessage, context);
            const splitReplies = this.messageSplitter.splitMessage(reply, 1, 4);
            replies.push(...splitReplies);
        }

        return replies;
    }

    calculateInsertPosition(sequence, member, index) {
        if (sequence.length === 0) return 0;

        let lastPosition = -1;
        for (let i = sequence.length - 1; i >= 0; i--) {
            if (sequence[i].sender === member.name) {
                lastPosition = i;
                break;
            }
        }

        if (lastPosition === -1) {
            return Math.floor(Math.random() * (sequence.length + 1));
        } else {
            const offset = Math.min(Math.floor(Math.random() * 3) + 1, sequence.length - lastPosition);
            return lastPosition + offset;
        }
    }

    calculateDelay(position) {
        const baseDelay = AI_CONFIG.GROUP_REPLY_DELAY.min;
        const randomDelay = Math.random() * (AI_CONFIG.GROUP_REPLY_DELAY.max - AI_CONFIG.GROUP_REPLY_DELAY.min);
        return baseDelay + randomDelay + (position * 500);
    }

    getActiveMembers(group) {
        return [
            {
                name: '小明',
                avatar: 'avatar1.jpg',
                personality: 'active',
                schedule: { wakeTime: 7, sleepTime: 23 }
            },
            {
                name: '小红',
                avatar: 'avatar2.jpg',
                personality: 'normal',
                schedule: { wakeTime: 8, sleepTime: 24 }
            },
            {
                name: '小李',
                avatar: 'avatar3.jpg',
                personality: 'quiet',
                schedule: { wakeTime: 6, sleepTime: 22 }
            }
        ];
    }

    async callAIForGroupReply(member, userMessage, context) {
        const timeInfo = getBeijingTime();
        const prompt = `
你是群成员"${member.name}"，性格：${member.personality || '普通'}
当前时间：${timeInfo.dayOfWeek} ${timeInfo.time}
用户说：${userMessage}
之前的对话：${context.map(c => `${c.sender}: ${c.content}`).join('\n')}

请用符合角色性格的方式回复，自然、简短、口语化。
`;

        const provider = document.getElementById('provider')?.value;
        const apiUrl = document.getElementById('apiUrl')?.value;
        const apiKey = document.getElementById('apiKey')?.value;
        const model = document.getElementById('model')?.value;

        if (!apiUrl || !apiKey || !model) {
            return `嗯嗯，${userMessage.substring(0, 10)}...`;
        }

        try {
            let response;

            if (provider === 'google') {
                response = await fetch(`${apiUrl}/models/${model}:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: {
                            temperature: 0.9,
                            maxOutputTokens: 300
                        }
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    return data.candidates?.[0]?.content?.parts?.[0]?.text || '收到！';
                }
            } else {
                response = await fetch(`${apiUrl}/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: model,
                        messages: [
                            { role: 'system', content: `你是${member.name}，${member.personality || '普通'}性格的群成员` },
                            { role: 'user', content: prompt }
                        ],
                        temperature: 0.9,
                        max_tokens: 300
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    return data.choices?.[0]?.message?.content || '好的';
                }
            }
        } catch (error) {
            console.error('群聊AI回复失败:', error);
        }

        const fallbacks = ['嗯嗯', '好的', '明白了', '收到', '+1', '赞同'];
        return fallbacks[Math.floor(Math.random() * fallbacks.length)];
    }
}
// ==================== 创建实例 ====================
// 把那三行代码放在这里！！！
const narrationGenerator = new NarrationGenerator();
const messageSplitter = new MessageSplitter();
const groupChatOrchestrator = new GroupChatOrchestrator();


// 群聊AI回复调用函数
async function callAIForGroupReply(member, userMessage, context) {
    const timeInfo = getBeijingTime();
    const prompt = `
你是群成员"${member.name}"，性格：${member.personality || '普通'}
当前时间：${timeInfo.dayOfWeek} ${timeInfo.time}
用户说：${userMessage}
之前的对话：${context.map(c => `${c.sender}: ${c.content}`).join('\n')}

请用符合角色性格的方式回复，自然、简短、口语化。
`;

    const provider = document.getElementById('provider')?.value;
    const apiUrl = document.getElementById('apiUrl')?.value;
    const apiKey = document.getElementById('apiKey')?.value;
    const model = document.getElementById('model')?.value;

    if (!apiUrl || !apiKey || !model) {
        return `嗯嗯，${userMessage.substring(0, 10)}...`;
    }

    try {
        let response;

        if (provider === 'google') {
            response = await fetch(`${apiUrl}/models/${model}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.9,
                        maxOutputTokens: 300
                    }
                })
            });

            if (response.ok) {
                const data = await response.json();
                return data.candidates?.[0]?.content?.parts?.[0]?.text || '收到！';
            }
        } else {
            response = await fetch(`${apiUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        { role: 'system', content: `你是${member.name}，${member.personality || '普通'}性格的群成员` },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.9,
                    max_tokens: 300
                })
            });

            if (response.ok) {
                const data = await response.json();
                return data.choices?.[0]?.message?.content || '好的';
            }
        }
    } catch (error) {
        console.error('群聊AI回复失败:', error);
    }

    const fallbacks = ['嗯嗯', '好的', '明白了', '收到', '+1', '赞同'];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}




// 替换原有的触发AI回复函数
async function triggerAIReply(userMessage) {
    const contact = contacts.find(c => c.id === currentChatId) ||
        groups.find(g => g.id === currentChatId);

    if (!contact) return;

    // 注册角色
    AIManager.roleManager.registerRole(currentChatId, {
        name: contact.name,
        background: contact.background,
        personality: contact.personality,
        gender: contact.gender
    });

    // 显示AI正在生成状态
    showAIGeneratingStatus(contact.name);

    try {
        // 使用统一AI管理器
        const response = await AIManager.request({
            scene: 'private_chat',
            roleId: currentChatId,
            message: userMessage,
            context: chatHistory[currentChatId]?.slice(-5) || [],
            metadata: { contactType: 'friend' }
        });

        hideAIGeneratingStatus();

        // 分割并发送消息
        const messages = messageSplitter.splitMessage(response, 6, 10);
        for (let i = 0; i < messages.length; i++) {
            await sendSingleMessage(messages[i], 'ai', contact);
            if (i < messages.length - 1) {
                await sleep(Math.random() * 1000 + 500);
            }
        }

        // 可能生成旁白
        if (narrationGenerator && narrationGenerator.shouldGenerateNarration()) {
            const narration = await narrationGenerator.generateNarration(
                userMessage + ' ' + messages.join(' '),
                contact
            );
            narrationGenerator.insertNarration(narration);
        }
        // 新增 个人板块
        // 在 triggerAIReply 函数的末尾，在 catch 块之前添加
        // 检查是否需要添加日历记录
        await checkAICalendarDecision(userMessage, contact);

        // 随机概率发送礼物
        if (Math.random() > 0.50) { // 50%概率
            setTimeout(() => {
                const giftMessage = generateAIGift(contact);
                addMessageToUI('ai', giftMessage, new Date().toLocaleTimeString(), true);
                saveMessageToHistory(currentChatId, 'ai', giftMessage);
                updateContactLastMessage(currentChatId, giftMessage);
            }, 3000);
        }

    } catch (error) {
        console.error('AI回复生成失败:', error);
        hideAIGeneratingStatus();
        addMessageToUI('ai', '抱歉，我现在有点累了，稍后再聊~', new Date().toLocaleTimeString(), true);
    }
}




// 新增 个人板块
// ==================== 交易处理集成 ====================
// 在 triggerAIReply 函数之后添加

// 处理AI消息中的交易    账户
function processAITransaction(message, contactId) {
    // 检查是否包含转账信息
    const transferMatch = message.match(/转账.*?([0-9.]+)元/);
    const redPacketMatch = message.match(/红包.*?\[¥([0-9.]+)\]/);
    const giftMatch = message.match(/送给你.*?(玫瑰|蛋糕|钻石|跑车|飞机)/);

    if (transferMatch) {
        const amount = parseFloat(transferMatch[1]);
        if (window.PersonalModule) {
            window.PersonalModule.addTransaction('income', amount, `收到转账`, contactId);
        }
    } else if (redPacketMatch) {
        const amount = parseFloat(redPacketMatch[1]);
        if (window.PersonalModule) {
            window.PersonalModule.addTransaction('income', amount, `收到红包`, contactId);
        }
    } else if (giftMatch) {
        const giftPrices = {
            '玫瑰': 10,
            '蛋糕': 50,
            '钻石': 100,
            '跑车': 500,
            '飞机': 1000
        };
        const gift = giftMatch[1];
        const amount = giftPrices[gift] || 0;
        if (amount > 0 && window.PersonalModule) {
            window.PersonalModule.addTransaction('income', amount, `收到礼物：${gift}`, contactId);
        }
    }
}

// AI主动发送礼物或转账
function generateAIGift(contact) {
    const gifts = [
        { name: '玫瑰', price: 10, emoji: '🌹' },
        { name: '蛋糕', price: 50, emoji: '🎂' },
        { name: '钻石', price: 100, emoji: '💎' }
    ];

    const gift = gifts[Math.floor(Math.random() * gifts.length)];
    const message = `${gift.emoji} 送给你一个${gift.name}，希望你喜欢~`;

    // 记录支出（从AI角度）
    if (window.PersonalModule) {
        window.PersonalModule.addTransaction('income', gift.price, `收到${contact.name}的${gift.name}`, contact.id);
    }

    return message;
}




// 构建完整上下文
function buildCompleteContext(contact, userMessage, memories) {
    const timeInfo = getBeijingTime();
    const worldBook = getWorldBookForCharacter(contact);

    return {
        character: {
            name: contact.name,
            background: contact.background,
            personality: contact.personality,
            gender: contact.gender
        },
        worldBook: worldBook,
        memories: memories,
        currentTime: {
            beijing: timeInfo.full.toLocaleString('zh-CN'),
            hour: timeInfo.hour,
            dayOfWeek: timeInfo.dayOfWeek
        },
        scene: getCurrentScene(),
        userMessage: userMessage,
        recentChat: chatHistory[currentChatId]?.slice(-10) || []
    };
}

// 获取角色的世界书
function getWorldBookForCharacter(contact) {
    const worldBooks = JSON.parse(localStorage.getItem('worldBooks') || '[]');
    return worldBooks.find(wb => wb.characters?.includes(contact.name))?.content || '';
}

// 增强的AI响应函数
async function getEnhancedAIResponse(context, contact) {
    const provider = document.getElementById('provider')?.value;
    const apiUrl = document.getElementById('apiUrl')?.value;
    const apiKey = document.getElementById('apiKey')?.value;
    const model = document.getElementById('model')?.value;

    if (!apiUrl || !apiKey || !model) {
        return '请先在API设置中配置AI模型哦~ 😊';
    }

    const systemPrompt = `
你是${context.character.name}，${context.character.background || ''}

世界设定：${context.worldBook}

当前北京时间：${context.currentTime.beijing}
现在是${context.currentTime.dayOfWeek}，${context.currentTime.hour}点

你的记忆：
- 最近互动：${JSON.stringify(context.memories.recent)}
- 情感状态：${context.memories.emotionalState}

重要规则：
1. 你始终知道现在的准确时间（北京时间）
2. 根据时间做出合适的反应（如深夜会困倦，早上会精神）
3. 保持角色性格的一致性
4. 记住之前的对话内容
5. 回复要自然、分段、口语化
`;

    try {
        let response;

        if (provider === 'google') {
            response = await fetch(`${apiUrl}/models/${model}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [
                        { parts: [{ text: systemPrompt }] },
                        { parts: [{ text: `用户说：${context.userMessage}\n\n请用自然、亲切的方式回复，像真实聊天一样。` }] }
                    ],
                    generationConfig: {
                        temperature: 0.85,
                        maxOutputTokens: 800
                    }
                })
            });

            if (response.ok) {
                const data = await response.json();
                return data.candidates?.[0]?.content?.parts?.[0]?.text || '嗯嗯，我明白了~';
            }
        } else {
            response = await fetch(`${apiUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        ...context.recentChat.map(msg => ({
                            role: msg.sender === 'user' ? 'user' : 'assistant',
                            content: msg.content
                        })),
                        { role: 'user', content: context.userMessage }
                    ],
                    temperature: 0.85,
                    max_tokens: 800
                })
            });

            if (response.ok) {
                const data = await response.json();
                return data.choices?.[0]?.message?.content || '好的，收到！';
            }
        }
    } catch (error) {
        console.error('AI响应错误:', error);
    }

    // 根据时间返回合适的备用回复
    const hour = context.currentTime.hour;
    if (hour >= 23 || hour < 6) {
        return '哈欠...有点困了呢，不过能和你聊天很开心~';
    } else if (hour >= 6 && hour < 12) {
        return '早上好呀！今天感觉怎么样？';
    } else if (hour >= 12 && hour < 18) {
        return '下午好！有什么有趣的事情分享吗？';
    } else {
        return '晚上好~ 今天过得怎么样呢？';
    }
}

// 发送单条消息
async function sendSingleMessage(content, sender, contact) {
    addMessageToUI(sender, content, new Date().toLocaleTimeString(), true);
    saveMessageToHistory(currentChatId, sender, content);

    if (contact) {
        contact.lastMessage = content.substring(0, 30) + (content.length > 30 ? '...' : '');
        contact.lastTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        updateContactsList();
        saveChatData();
    }
}

// 显示AI生成状态
function showAIGeneratingStatus(name) {
    const messagesContainer = document.getElementById('chatMessagesContainer');
    if (!messagesContainer) return;

    const statusDiv = document.createElement('div');
    statusDiv.id = 'ai-generating-status';
    statusDiv.className = 'ai-generating';
    statusDiv.innerHTML = `
<div class="generating-spinner"></div>
<span class="ai-generating-text">${name}正在思考...</span>
`;

    messagesContainer.appendChild(statusDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// 隐藏AI生成状态
function hideAIGeneratingStatus() {
    const statusDiv = document.getElementById('ai-generating-status');
    if (statusDiv) {
        statusDiv.remove();
    }
}

// 增强的群聊回复触发
async function triggerGroupReply(userMessage) {
    const group = groups.find(g => g.id === currentChatId);
    if (!group) return;

    // 模拟群成员
    const members = [
        { id: 'member1', name: '小明', personality: 'active' },
        { id: 'member2', name: '小红', personality: 'quiet' },
        { id: 'member3', name: '小李', personality: 'funny' }
    ];

    // 随机选择1-3个成员回复
    const respondingMembers = members
        .filter(() => Math.random() > 0.5)
        .slice(0, Math.floor(Math.random() * 2) + 1);

    if (respondingMembers.length === 0) {
        respondingMembers.push(members[0]);
    }

    // 批量生成回复
    const requests = respondingMembers.map(member => {
        // 注册群成员角色
        AIManager.roleManager.registerRole(`group_${member.id}`, {
            name: member.name,
            personality: member.personality,
            background: `${group.name}的成员`
        });

        return {
            scene: 'group_chat',
            roleId: `group_${member.id}`,
            message: userMessage,
            context: chatHistory[currentChatId]?.slice(-3) || [],
            metadata: {
                groupId: group.id,
                groupName: group.name,
                memberName: member.name
            }
        };
    });

    try {
        const responses = await AIManager.batchRequest(requests);

        // 逐个显示群成员回复
        for (let i = 0; i < responses.length; i++) {
            const member = respondingMembers[i];
            const response = responses[i];

            // 延迟显示
            await sleep(500 + Math.random() * 1500);

            // 显示群成员正在输入
            showGroupMemberTyping(member.name);
            await sleep(1000);
            hideGroupMemberTyping();

            // 添加群成员消息
            addGroupMemberMessage(member.name, null, response);
            saveMessageToHistory(currentChatId, member.name, response);
        }

    } catch (error) {
        console.error('群聊回复失败:', error);
        // 使用降级响应
        const fallbackReply = AIManager.getFallbackResponse({ scene: 'group_chat' });
        addGroupMemberMessage('小明', null, fallbackReply);
    }
}

// 3. 新增：论坛回复功能（示例）
async function generateForumReply(postContent, postId) {
    const forumUser = {
        id: 'forum_user_1',
        name: 'AI评论员',
        background: '资深论坛用户'
    };

    AIManager.roleManager.registerRole(forumUser.id, forumUser);

    try {
        const response = await AIManager.request({
            scene: 'forum',
            roleId: forumUser.id,
            message: postContent,
            context: [],
            metadata: { postId, forumSection: 'general' }
        });

        return response;
    } catch (error) {
        console.error('论坛回复生成失败:', error);
        return '这是一个很有意思的话题，值得深入讨论。';
    }
}

// 4. 新增：朋友圈评论功能（示例）
async function generateMomentComment(momentContent, authorId) {
    const commenter = {
        id: 'moment_commenter_1',
        name: 'AI好友',
        background: '热心的朋友'
    };

    AIManager.roleManager.registerRole(commenter.id, commenter);

    try {
        const response = await AIManager.request({
            scene: 'moments',
            roleId: commenter.id,
            message: momentContent,
            context: [],
            metadata: { authorId, momentType: 'photo' },
            priority: 'low' // 朋友圈评论优先级较低
        });

        return response;
    } catch (error) {
        console.error('朋友圈评论生成失败:', error);
        return '👍 很棒！';
    }
}

// 5. 监控和调试工具
window.AIManagerDebug = {
    // 查看当前状态
    status() {
        console.table(AIManager.getStats());
    },

    // 查看队列
    queue() {
        console.log('当前队列:', AIManager.queue);
    },

    // 查看缓存
    cache() {
        console.log('缓存内容:', Array.from(AIManager.cache.entries()));
    },

    // 清空缓存
    clearCache() {
        AIManager.cache.clear();
        console.log('缓存已清空');
    },

    // 查看角色
    roles() {
        console.log('注册的角色:', Array.from(AIManager.roleManager.roles.entries()));
    }
};

// 初始化提示
console.log('✅ 统一AI交互管理器已加载');
console.log('使用 AIManagerDebug.status() 查看状态');
console.log('功能支持：单聊、群聊、论坛、朋友圈等多场景AI交互');

// 辅助函数：延迟
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// AI生成回复按钮的处理函数
function generateAIReply() {
    if (!currentChatId) {
        alert('请先选择聊天对象');
        return;
    }

    // 获取输入框的内容，如果没有内容就用默认消息
    const input = document.getElementById('chatInputField');
    const message = input.value.trim() || '你好';

    // 如果有内容，先发送用户消息
    if (input.value.trim()) {
        sendChatMessage();
    } else {
        // 如果没有内容，直接触发AI回复
        triggerAIReply('继续聊天');
    }
}




// 处理消息内容（处理@提及等）
function processMessageContent(content) {
    // 处理@提及
    content = content.replace(/@(\S+)/g, '<span class="message-mention">@$1</span>');
    return content;
}

// 生成默认头像
function generateDefaultAvatar(name) {
    const colors = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4fc3f7'];
    const color = colors[name.charCodeAt(0) % colors.length];
    return `data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Ccircle cx="50" cy="50" r="50" fill="${encodeURIComponent(color)}"/%3E%3Ctext x="50" y="55" text-anchor="middle" fill="white" font-size="40"%3E${name[0]}%3C/text%3E%3C/svg%3E`;
}

// 添加系统消息
function addSystemMessage(content) {
    const messagesContainer = document.getElementById('chatMessagesContainer');
    if (!messagesContainer) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-narration';
    messageDiv.style.fontStyle = 'italic';
    messageDiv.textContent = content;

    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// 辅助函数：延迟
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 初始化增强系统
document.addEventListener('DOMContentLoaded', function () {
    // 加载记忆池
    CharacterMemoryPool.load();

    // 添加时间显示
    setInterval(() => {
        const timeInfo = getBeijingTime();
        // 可以在界面上显示当前时间
        console.log('当前北京时间：', timeInfo.full.toLocaleString('zh-CN'));
    }, 60000); // 每分钟更新
});

// 导出模块供外部使用
window.EnhancedAISystem = {
    narrationGenerator,
    messageSplitter,
    groupChatOrchestrator,
    CharacterMemoryPool,
    getBeijingTime,
    triggerAIReply,
    triggerGroupReply
};

// ==================== 工具栏功能 ====================

// 转账功能
function showTransfer() {
    if (!currentChatId) {
        alert('请先选择聊天对象');
        return;
    }

    const amount = prompt('请输入转账金额（元）：');
    if (amount && !isNaN(amount) && amount > 0) {
        const message = `💳 向您转账 ¥${parseFloat(amount).toFixed(2)}`;
        addMessageToUI('user', message, new Date().toLocaleTimeString(), true);
        saveMessageToHistory(currentChatId, 'user', message);
        updateContactLastMessage(currentChatId, message);

        setTimeout(() => {
            const reply = '谢谢你的转账！已收到~ 😊';
            addMessageToUI('ai', reply, new Date().toLocaleTimeString(), true);
            saveMessageToHistory(currentChatId, 'ai', reply);
        }, 1000);
    }
}

// 红包功能
function showRedPacket() {
    if (!currentChatId) {
        alert('请先选择聊天对象');
        return;
    }

    const amount = prompt('请输入红包金额（元）：');
    if (amount && !isNaN(amount) && amount > 0) {
        const message = `🧧 发了一个红包 [¥${parseFloat(amount).toFixed(2)}]`;
        addMessageToUI('user', message, new Date().toLocaleTimeString(), true);
        saveMessageToHistory(currentChatId, 'user', message);
        updateContactLastMessage(currentChatId, message);

        setTimeout(() => {
            const replies = [
                '哇！收到红包了，谢谢！🎉',
                '太棒了！手气不错呢~ 😄',
                '谢谢老板！恭喜发财~ 💰'
            ];
            const reply = replies[Math.floor(Math.random() * replies.length)];
            addMessageToUI('ai', reply, new Date().toLocaleTimeString(), true);
            saveMessageToHistory(currentChatId, 'ai', reply);
        }, 800);
    }
}

// 礼物功能
function showGift() {
    if (!currentChatId) {
        alert('请先选择聊天对象');
        return;
    }

    const gifts = ['🌹 玫瑰', '🎂 蛋糕', '💎 钻石', '🚗 跑车', '✈️ 飞机'];
    const gift = prompt('请选择礼物：\n1. 玫瑰\n2. 蛋糕\n3. 钻石\n4. 跑车\n5. 飞机');

    if (gift && gift >= 1 && gift <= 5) {
        const message = `🎁 送给你 ${gifts[gift - 1]}`;
        addMessageToUI('user', message, new Date().toLocaleTimeString(), true);
        saveMessageToHistory(currentChatId, 'user', message);
        updateContactLastMessage(currentChatId, message);

        setTimeout(() => {
            const reply = '哇！好棒的礼物，我很喜欢！💕';
            addMessageToUI('ai', reply, new Date().toLocaleTimeString(), true);
            saveMessageToHistory(currentChatId, 'ai', reply);
        }, 1000);
    }
}

// 上传图片
function uploadImage() {
    if (!currentChatId) {
        alert('请先选择聊天对象');
        return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = function (e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (e) {
                const message = `<img src="${e.target.result}" style="max-width: 200px; border-radius: 8px;">`;
                addMessageToUI('user', message, new Date().toLocaleTimeString(), true);
                saveMessageToHistory(currentChatId, 'user', '[图片]');
                updateContactLastMessage(currentChatId, '[图片]');

                setTimeout(() => {
                    const reply = '好漂亮的图片呀！📸';
                    addMessageToUI('ai', reply, new Date().toLocaleTimeString(), true);
                    saveMessageToHistory(currentChatId, 'ai', reply);
                }, 1000);
            };
            reader.readAsDataURL(file);
        }
    };
    input.click();
}

// 表情包功能
function showEmoji() {
    if (!currentChatId) {
        alert('请先选择聊天对象');
        return;
    }

    const emojis = ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😊', '😇', '🥰', '😍', '🤩', '😘'];
    const emojiPicker = prompt('选择一个表情：\n' + emojis.join(' '));

    if (emojiPicker) {
        addMessageToUI('user', emojiPicker, new Date().toLocaleTimeString(), true);
        saveMessageToHistory(currentChatId, 'user', emojiPicker);
        updateContactLastMessage(currentChatId, emojiPicker);
    }
}

// 日记功能
function showDiary() {
    if (!currentChatId) {
        alert('请先选择聊天对象');
        return;
    }

    const diary = prompt('写下今天的日记：');
    if (diary) {
        const message = `📔 今日日记：\n${diary}`;
        addMessageToUI('user', message, new Date().toLocaleTimeString(), true);
        saveMessageToHistory(currentChatId, 'user', message);
        updateContactLastMessage(currentChatId, '[日记]');

        setTimeout(() => {
            const reply = '谢谢分享你的日记，很有意思呢！✨';
            addMessageToUI('ai', reply, new Date().toLocaleTimeString(), true);
            saveMessageToHistory(currentChatId, 'ai', reply);
        }, 1200);
    }
}

// 心声功能
function showVoice() {
    if (!currentChatId) {
        alert('请先选择聊天对象');
        return;
    }

    const voice = prompt('说出你的心声：');
    if (voice) {
        const message = `💭 心声：${voice}`;
        addMessageToUI('user', message, new Date().toLocaleTimeString(), true);
        saveMessageToHistory(currentChatId, 'user', message);
        updateContactLastMessage(currentChatId, '[心声]');

        setTimeout(() => {
            const reply = '我能感受到你的心情，谢谢你愿意和我分享~ 💖';
            addMessageToUI('ai', reply, new Date().toLocaleTimeString(), true);
            saveMessageToHistory(currentChatId, 'ai', reply);
        }, 1000);
    }
}

// 音乐功能
function showMusic() {
    if (!currentChatId) {
        alert('请先选择聊天对象');
        return;
    }

    const music = prompt('分享歌曲名称：');
    if (music) {
        const message = `🎵 分享音乐：《${music}》`;
        addMessageToUI('user', message, new Date().toLocaleTimeString(), true);
        saveMessageToHistory(currentChatId, 'user', message);
        updateContactLastMessage(currentChatId, '[音乐]');

        setTimeout(() => {
            const reply = '这首歌真好听！我也很喜欢~ 🎶';
            addMessageToUI('ai', reply, new Date().toLocaleTimeString(), true);
            saveMessageToHistory(currentChatId, 'ai', reply);
        }, 1000);
    }
}

// 转发消息
function forwardMessage() {
    const history = chatHistory[currentChatId];
    if (!history || history.length === 0) {
        alert('没有可转发的消息');
        return;
    }

    const lastMessage = history[history.length - 1];
    const targetContact = prompt('转发给（输入联系人名称）：');

    if (targetContact) {
        alert(`已将消息转发给 ${targetContact}`);
    }
}

// 撤回消息
function recallMessage() {
    const history = chatHistory[currentChatId];
    if (!history || history.length === 0) {
        alert('没有可撤回的消息');
        return;
    }

    const lastUserMessage = history.filter(m => m.sender === 'user').pop();
    if (lastUserMessage) {
        const index = history.indexOf(lastUserMessage);
        history.splice(index, 1);
        saveChatData();
        loadChatHistory(currentChatId);
        alert('消息已撤回');
    }
}

// 删除消息
function deleteMessage() {
    if (confirm('确定要清空与该联系人的所有聊天记录吗？')) {
        chatHistory[currentChatId] = [];
        saveChatData();
        loadChatHistory(currentChatId);
        alert('聊天记录已清空');
    }
}

// ==================== 联系人管理弹窗功能 ====================

// 显示添加好友弹窗
function showAddFriend() {
    document.getElementById('addFriendModal').style.display = 'flex';
    // 头像上传预览功能
    document.addEventListener('DOMContentLoaded', function () {
        const friendAvatarInput = document.getElementById('friendAvatar');
        if (friendAvatarInput) {
            friendAvatarInput.addEventListener('change', function (e) {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = function (event) {
                        const preview = document.querySelector('#addFriendModal .avatar-preview');
                        if (preview) {
                            preview.innerHTML = `<img src="${event.target.result}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
                        }
                    };
                    reader.readAsDataURL(file);
                }
            });
        }
    });
}

// 确认添加好友
// 确认添加好友
// 确认添加好友
function confirmAddFriend() {
    const name = document.getElementById('friendName').value.trim();
    const characterName = document.getElementById('friendCharacterName').value.trim();
    const gender = document.getElementById('friendGender').value;
    const background = document.getElementById('friendBackground').value.trim();
    const avatarInput = document.getElementById('friendAvatar');

    if (!name && !characterName) {
        alert('请至少输入备注名称或角色姓名');
        return;
    }

    // 处理头像
    const processAvatar = (avatarData) => {
        const newFriend = {
            id: 'friend_' + Date.now(),
            name: name || characterName,  // 如果没有备注名，使用角色姓名
            characterName: characterName,  // 新增角色姓名字段
            displayName: name || characterName,  // 显示名称
            avatar: avatarData || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Ccircle cx="50" cy="50" r="50" fill="%23' +
                Math.floor(Math.random() * 16777215).toString(16) +
                '"/%3E%3Ctext x="50" y="55" text-anchor="middle" fill="white" font-size="40"%3E' +
                (name || characterName)[0].toUpperCase() + '%3C/text%3E%3C/svg%3E',
            status: Math.random() > 0.3 ? 'online' : 'offline',
            lastMessage: '新朋友',
            lastTime: '刚刚',
            unread: 0,
            background: background || `我是${characterName || name}，很高兴认识你！`,
            gender: gender
        };

        contacts.push(newFriend);
        saveChatData();
        updateContactsList();
        closeModal('addFriendModal');

        // 清空表单
        document.getElementById('friendName').value = '';
        document.getElementById('friendCharacterName').value = '';
        document.getElementById('friendBackground').value = '';
        document.getElementById('friendAvatar').value = '';

        // 重置头像预览
        const preview = document.querySelector('#addFriendModal .avatar-preview');
        if (preview) {
            preview.innerHTML = '<span> 点击上传</span>';
        }

        alert(`成功添加好友：${name || characterName}`);
    };

    // 如果有选择图片，读取图片数据
    if (avatarInput.files && avatarInput.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            processAvatar(e.target.result);
        };
        reader.readAsDataURL(avatarInput.files[0]);
    } else {
        processAvatar(null);
    }
}


// 显示创建群聊弹窗
function showCreateGroup() {
    document.getElementById('createGroupModal').style.display = 'flex';

    // 生成可选成员列表
    const memberList = document.querySelector('.member-select-list');
    if (memberList) {
        memberList.innerHTML = contacts.map(c => `
    <label style="display: block; margin: 5px 0;">
        <input type="checkbox" value="${c.id}" name="groupMember">
        ${c.name}
    </label>
`).join('');
    }
}

// 确认创建群聊
function confirmCreateGroup() {
    const name = document.getElementById('groupName').value.trim();
    const selectedMembers = Array.from(document.querySelectorAll('input[name="groupMember"]:checked'))
        .map(cb => cb.value);

    if (!name) {
        alert('请输入群聊名称');
        return;
    }

    if (selectedMembers.length < 1) {
        alert('请至少选择一个成员');
        return;
    }

    const newGroup = {
        id: 'group_' + Date.now(),
        name: name,
        avatar: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Ccircle cx="50" cy="50" r="50" fill="%2334495e"/%3E%3Ctext x="50" y="55" text-anchor="middle" fill="white" font-size="30"%3E群%3C/text%3E%3C/svg%3E',
        status: 'online',
        lastMessage: '群聊已创建',
        lastTime: '刚刚',
        unread: 0,
        members: selectedMembers,
        owner: 'self'
    };

    groups.push(newGroup);
    saveChatData();
    updateContactsList();
    closeModal('createGroupModal');

    // 清空表单
    document.getElementById('groupName').value = '';

    alert(`成功创建群聊：${name}`);
}

// 群聊消息回复
function triggerGroupReply(userMessage) {
    const group = groups.find(g => g.id === currentChatId);
    if (!group) return;

    const memberNames = ['小明', '小红', '小李', '小张', '小王'];
    const randomMember = memberNames[Math.floor(Math.random() * memberNames.length)];

    const replies = [
        '说得对！',
        '赞同 👍',
        '哈哈哈，有意思',
        '我也是这么想的',
        '+1',
        '收到！',
        '明白了'
    ];

    const reply = `[${randomMember}]: ${replies[Math.floor(Math.random() * replies.length)]}`;

    // 替换为：
    // 新增：添加群成员消息的专用函数
    function addGroupMemberMessage(memberName, memberAvatar, content) {
        const messagesContainer = document.getElementById('chatMessagesContainer');
        if (!messagesContainer) return;

        // 清除欢迎消息
        const welcomeMsg = messagesContainer.querySelector('.chat-welcome-message');
        if (welcomeMsg) welcomeMsg.remove();

        // 如果没有提供头像，生成默认头像
        if (!memberAvatar) {
            const colors = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4fc3f7', '#29b6f6'];
            const color = colors[Math.floor(Math.random() * colors.length)];
            memberAvatar = `data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Ccircle cx="50" cy="50" r="50" fill="${encodeURIComponent(color)}"/%3E%3Ctext x="50" y="55" text-anchor="middle" fill="white" font-size="40"%3E${memberName[0]}%3C/text%3E%3C/svg%3E`;
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message message-received';
        messageDiv.style.animation = 'messageSlide 0.3s ease';

        messageDiv.innerHTML = `
<div class="message-avatar">
    <img src="${memberAvatar}" alt="${memberName}">
</div>
<div class="message-content-wrapper">
    <div class="message-bubble">
        ${content}
        <div class="message-time" style="font-size: 10px; opacity: 0.7; margin-top: 4px;">
            ${new Date().toLocaleTimeString()}
        </div>
    </div>
</div>
`;

        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // 修改 triggerGroupReply 函数的最后部分
    async function triggerGroupReply(userMessage) {
        const group = groups.find(g => g.id === currentChatId);
        if (!group) return;

        // 使用GroupChatOrchestrator生成回复
        const orchestrator = new GroupChatOrchestrator();
        // 直接使用全局的callAIForGroupReply函数

        const replies = await orchestrator.generateGroupReplies(userMessage, group);

        // 逐个显示回复
        for (const reply of replies) {
            await sleep(reply.delay || 1000);

            if (reply.type === 'system') {
                addSystemMessage(reply.content);
            } else {
                // 显示群成员正在输入
                showGroupMemberTyping(reply.sender);
                await sleep(1000);
                hideGroupMemberTyping();

                // 添加群成员消息（不显示名字在气泡内）
                addGroupMemberMessage(reply.sender, reply.avatar, reply.content);
                saveMessageToHistory(currentChatId, reply.sender, reply.content);
            }
        }

        updateContactLastMessage(currentChatId, replies[replies.length - 1]?.content || '群消息');
    }

    // 新增：显示群成员正在输入
    function showGroupMemberTyping(memberName) {
        const messagesContainer = document.getElementById('chatMessagesContainer');
        if (!messagesContainer) return;

        // 移除已存在的输入指示器
        hideGroupMemberTyping();

        const typingDiv = document.createElement('div');
        typingDiv.id = 'group-member-typing';
        typingDiv.className = 'typing-wrapper';
        typingDiv.innerHTML = `
<div class="generating-spinner"></div>
<span class="typing-user">${memberName} 正在输入...</span>
`;

        messagesContainer.appendChild(typingDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // 新增：隐藏群成员正在输入
    function hideGroupMemberTyping() {
        const typingDiv = document.getElementById('group-member-typing');
        if (typingDiv) {
            typingDiv.remove();
        }
    }

    const messagesContainer = document.getElementById('chatMessagesContainer');
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    saveMessageToHistory(currentChatId, 'ai', reply);
    updateContactLastMessage(currentChatId, reply);
}

// ==================== 其他功能 ====================

// 导出聊天记录
// 导出聊天记录
// 导出聊天记录
function exportChat() {
    if (!currentChatId) {
        alert('请先选择要导出的聊天');
        return;
    }

    const history = chatHistory[currentChatId] || [];
    if (history.length === 0) {
        alert('没有聊天记录可导出');
        return;
    }

    // 查找联系人信息
    const contact = contacts.find(c => c.id === currentChatId) ||
        groups.find(g => g.id === currentChatId);

    if (!contact) {
        alert('找不到联系人信息');
        return;
    }

    // 构建导出数据
    const exportData = {
        exportInfo: {
            version: '1.0',
            exportTime: new Date().toISOString(),
            exportDate: new Date().toLocaleString('zh-CN'),
            platform: 'G专属聊天系统'
        },
        contactInfo: {
            id: contact.id,
            name: contact.name,
            type: groups.find(g => g.id === currentChatId) ? 'group' : 'friend',
            avatar: contact.avatar,
            status: contact.status,
            background: contact.background || '',
            gender: contact.gender || ''
        },
        chatStatistics: {
            totalMessages: history.length,
            userMessages: history.filter(m => m.sender === 'user').length,
            contactMessages: history.filter(m => m.sender !== 'user').length,
            firstMessageTime: history.length > 0 ? history[0].time : null,
            lastMessageTime: history.length > 0 ? history[history.length - 1].time : null
        },
        messages: history.map((msg, index) => ({
            id: index + 1,
            sender: msg.sender,
            senderName: msg.sender === 'user' ? '我' : contact.name,
            content: msg.content,
            time: msg.time,
            timestamp: msg.timestamp || new Date().toISOString()
        }))
    };

    try {
        // 转换为JSON字符串（格式化输出）
        const jsonString = JSON.stringify(exportData, null, 2);

        // 创建Blob对象
        const blob = new Blob([jsonString], {
            type: 'application/json;charset=utf-8'
        });

        // 创建临时URL
        const url = window.URL.createObjectURL(blob);

        // 创建隐藏的下载链接
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = `聊天记录_${contact.name}_${new Date().getTime()}.json`;

        // 添加到DOM（某些浏览器需要）
        document.body.appendChild(downloadLink);

        // 触发点击下载
        downloadLink.click();

        // 清理：移除链接和释放URL
        setTimeout(() => {
            document.body.removeChild(downloadLink);
            window.URL.revokeObjectURL(url);
        }, 100);

        // 关闭下拉菜单
        const menu = document.getElementById('chatDropdownMenu');
        if (menu) menu.style.display = 'none';

        // 显示成功提示（可选）
        console.log('聊天记录导出成功');

    } catch (error) {
        console.error('导出失败:', error);
        alert('导出聊天记录失败，请重试');
    }
}







// 编辑联系人
function editContact() {
    if (!currentChatId) {
        alert('请先选择要编辑的联系人');
        return;
    }

    const contact = contacts.find(c => c.id === currentChatId);
    const group = groups.find(g => g.id === currentChatId);

    if (contact) {
        // 编辑好友
        showEditFriendModal(contact);
    } else if (group) {
        // 编辑群聊
        showEditGroupModal(group);
    } else {
        alert('找不到要编辑的联系人');
    }

    // 关闭下拉菜单
    const menu = document.getElementById('chatDropdownMenu');
    if (menu) menu.style.display = 'none';
}
// 显示编辑好友模态框
// 显示编辑好友模态框
function showEditFriendModal(contact) {
    // 先移除已存在的模态框
    const existingModal = document.getElementById('editFriendModal');
    if (existingModal) {
        existingModal.remove();
    }

    // 创建编辑模态框
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'editFriendModal';
    modal.innerHTML = `
<div class="modal-content">
    <div class="modal-header">
        <h3>修改好友设定</h3>
        <button class="modal-close" onclick="closeEditModal('editFriendModal')">×</button>
    </div>
    <div class="modal-body">
        <div class="form-group">
            <label>头像</label>
            <div class="avatar-upload">
                <input type="file" id="editFriendAvatar" accept="image/*" style="display: none;">
                <div class="avatar-preview" id="editAvatarPreview" onclick="document.getElementById('editFriendAvatar').click()">
                    <img src="${contact.avatar}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">
                </div>
            </div>
        </div>
        <div class="form-group">
            <label>备注名称</label>
            <input type="text" id="editFriendName" value="${contact.name || ''}" placeholder="请输入备注名称">
        </div>
        <div class="form-group">
            <label>角色姓名</label>
            <input type="text" id="editFriendCharacterName" value="${contact.characterName || ''}" placeholder="请输入角色姓名">
        </div>
        <div class="form-group">
            <label>性别</label>
            <select id="editFriendGender">
                <option value="male" ${contact.gender === 'male' ? 'selected' : ''}>男</option>
                <option value="female" ${contact.gender === 'female' ? 'selected' : ''}>女</option>
                <option value="other" ${contact.gender === 'other' ? 'selected' : ''}>其他</option>
            </select>
        </div>
        <div class="form-group">
            <label>人物背景</label>
            <textarea id="editFriendBackground" placeholder="描述人物背景..." rows="3">${contact.background || ''}</textarea>
        </div>
    </div>
    <div class="modal-footer">
        <button class="btn-cancel" onclick="closeEditModal('editFriendModal')">取消</button>
        <button class="btn-confirm" onclick="saveEditedFriend('${contact.id}')">保存</button>
    </div>
</div>
`;

    document.body.appendChild(modal);
    modal.style.display = 'flex';

    // 头像上传预览
    document.getElementById('editFriendAvatar').addEventListener('change', function (e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (event) {
                const preview = document.getElementById('editAvatarPreview');
                if (preview) {
                    preview.innerHTML = `<img src="${event.target.result}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
                }
            };
            reader.readAsDataURL(file);
        }
    });
}

// 保存编辑的好友信息
// 保存编辑的好友信息
function saveEditedFriend(contactId) {
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) {
        alert('找不到该联系人');
        return;
    }

    const name = document.getElementById('editFriendName').value.trim();
    const characterName = document.getElementById('editFriendCharacterName').value.trim();
    const gender = document.getElementById('editFriendGender').value;
    const background = document.getElementById('editFriendBackground').value.trim();

    if (!name && !characterName) {
        alert('请至少输入备注名称或角色姓名');
        return;
    }

    // 更新联系人信息
    contact.name = name || characterName;
    contact.characterName = characterName;
    contact.displayName = name || characterName;
    contact.gender = gender;
    contact.background = background;

    // 处理头像更新
    const avatarInput = document.getElementById('editFriendAvatar');
    if (avatarInput && avatarInput.files && avatarInput.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            contact.avatar = e.target.result;
            finishSaveEditedFriend();
        };
        reader.readAsDataURL(avatarInput.files[0]);
    } else {
        finishSaveEditedFriend();
    }

    function finishSaveEditedFriend() {
        saveChatData();
        updateContactsList();
        updateChatHeader(contact);
        closeEditModal('editFriendModal');

        // 显示成功提示
        const successMsg = document.createElement('div');
        successMsg.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: #4CAF50; color: white; padding: 15px 30px; border-radius: 8px; z-index: 10001; transition: opacity 0.3s;';
        successMsg.textContent = '好友信息已更新';
        document.body.appendChild(successMsg);

        setTimeout(() => {
            successMsg.style.opacity = '0';
            setTimeout(() => successMsg.remove(), 300);
        }, 2000);
    }
}
// 显示编辑群聊模态框
// 显示编辑群聊模态框
function showEditGroupModal(group) {
    // 先移除已存在的模态框
    const existingModal = document.getElementById('editGroupModal');
    if (existingModal) {
        existingModal.remove();
    }

    // 创建编辑模态框
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'editGroupModal';
    modal.innerHTML = `
<div class="modal-content">
    <div class="modal-header">
        <h3>修改群聊设定</h3>
        <button class="modal-close" onclick="closeEditModal('editGroupModal')">×</button>
    </div>
    <div class="modal-body">
        <div class="form-group">
            <label>群聊头像</label>
            <div class="avatar-upload">
                <input type="file" id="editGroupAvatar" accept="image/*" style="display: none;">
                <div class="avatar-preview" id="editGroupAvatarPreview" onclick="document.getElementById('editGroupAvatar').click()">
                    <img src="${group.avatar}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">
                </div>
            </div>
        </div>
        <div class="form-group">
            <label>群聊名称</label>
            <input type="text" id="editGroupName" value="${group.name}" placeholder="请输入群聊名称">
        </div>
        <div class="form-group">
            <label>选择群主</label>
            <select id="editGroupOwner">
                <option value="self" ${group.owner === 'self' ? 'selected' : ''}>我自己</option>
                ${contacts.map(c => `
                    <option value="${c.id}" ${group.owner === c.id ? 'selected' : ''}>${c.name}</option>
                `).join('')}
            </select>
        </div>
        <div class="form-group">
            <label>选择成员</label>
            <div class="member-select-list" id="editMemberList" style="max-height: 200px; overflow-y: auto; border: 1px solid #e0e0e0; border-radius: 8px; padding: 10px;">
                ${contacts.map(c => `
                    <label style="display: block; margin: 5px 0;">
                        <input type="checkbox" value="${c.id}" name="editGroupMember" 
                            ${group.members && group.members.includes(c.id) ? 'checked' : ''}>
                        ${c.name}
                    </label>
                `).join('')}
            </div>
        </div>
    </div>
    <div class="modal-footer">
        <button class="btn-cancel" onclick="closeEditModal('editGroupModal')">取消</button>
        <button class="btn-confirm" onclick="saveEditedGroup('${group.id}')">保存</button>
    </div>
</div>
`;

    document.body.appendChild(modal);
    modal.style.display = 'flex';

    // 头像上传预览
    document.getElementById('editGroupAvatar').addEventListener('change', function (e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (event) {
                const preview = document.getElementById('editGroupAvatarPreview');
                if (preview) {
                    preview.innerHTML = `<img src="${event.target.result}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
                }
            };
            reader.readAsDataURL(file);
        }
    });
}

// 保存编辑的群聊信息
// 保存编辑的群聊信息
function saveEditedGroup(groupId) {
    const group = groups.find(g => g.id === groupId);
    if (!group) {
        alert('找不到该群聊');
        return;
    }

    const name = document.getElementById('editGroupName').value.trim();
    const owner = document.getElementById('editGroupOwner').value;
    const selectedMembers = Array.from(document.querySelectorAll('input[name="editGroupMember"]:checked'))
        .map(cb => cb.value);

    if (!name) {
        alert('请输入群聊名称');
        return;
    }

    if (selectedMembers.length < 1) {
        alert('请至少选择一个成员');
        return;
    }

    // 更新群聊信息
    group.name = name;
    group.owner = owner;
    group.members = selectedMembers;

    // 处理头像更新
    const avatarInput = document.getElementById('editGroupAvatar');
    if (avatarInput && avatarInput.files && avatarInput.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            group.avatar = e.target.result;
            finishSaveEditedGroup();
        };
        reader.readAsDataURL(avatarInput.files[0]);
    } else {
        finishSaveEditedGroup();
    }

    function finishSaveEditedGroup() {
        saveChatData();
        updateContactsList();
        updateChatHeader(group);
        closeEditModal('editGroupModal');

        // 显示成功提示
        const successMsg = document.createElement('div');
        successMsg.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: #4CAF50; color: white; padding: 15px 30px; border-radius: 8px; z-index: 10001; transition: opacity 0.3s;';
        successMsg.textContent = '群聊信息已更新';
        document.body.appendChild(successMsg);

        setTimeout(() => {
            successMsg.style.opacity = '0';
            setTimeout(() => successMsg.remove(), 300);
        }, 2000);
    }
}

// 删除联系人
function deleteContact() {
    if (!currentChatId) {
        alert('请先选择要删除的联系人');
        return;
    }

    if (currentChatId === 'ai_assistant') {
        alert('默认AI助手不能删除');
        return;
    }

    if (confirm('确定要删除该联系人吗？聊天记录也将被清空。')) {
        // 删除联系人
        contacts = contacts.filter(c => c.id !== currentChatId);
        groups = groups.filter(g => g.id !== currentChatId);

        // 删除聊天记录
        delete chatHistory[currentChatId];

        // 重置当前聊天
        currentChatId = null;

        // 更新UI
        saveChatData();
        updateContactsList();
        document.getElementById('chatMessagesContainer').innerHTML = `
    <div class="chat-welcome-message">
        <div class="welcome-icon">💬</div>
        <div class="welcome-text">选择联系人开始聊天</div>
    </div>
`;

        alert('联系人已删除');
    }
}

// 关闭弹窗
function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}
// 关闭编辑模态框的辅助函数
function closeEditModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        // 添加淡出动画
        modal.style.opacity = '0';
        modal.style.transition = 'opacity 0.3s ease';

        setTimeout(() => {
            modal.remove();
        }, 300);
    }
}

// 显示AI输入状态
function showAITyping() {
    const messagesContainer = document.getElementById('chatMessagesContainer');
    if (!messagesContainer) return;

    const typingDiv = document.createElement('div');
    typingDiv.id = 'ai-typing';
    typingDiv.className = 'chat-message message-received';
    typingDiv.innerHTML = `
<div class="message-bubble">
    <div class="typing-indicator">
        <span></span>
        <span></span>
        <span></span>
    </div>
</div>
`;

    messagesContainer.appendChild(typingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// 隐藏AI输入状态
function hideAITyping() {
    const typingDiv = document.getElementById('ai-typing');
    if (typingDiv) {
        typingDiv.remove();
    }
}

// 显示通知
function showNotification(title, message) {
    // 检查浏览器是否支持通知
    if (!("Notification" in window)) {
        return;
    }

    // 检查权限
    if (Notification.permission === "granted") {
        new Notification(title, {
            body: message,
            icon: '/favicon.ico'
        });
    } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                new Notification(title, {
                    body: message,
                    icon: '/favicon.ico'
                });
            }
        });
    }
}

// 添加输入动画CSS
const style = document.createElement('style');
style.textContent = `
.typing-indicator {
display: flex;
align-items: center;
gap: 4px;
}

.typing-indicator span {
width: 8px;
height: 8px;
border-radius: 50%;
background: #999;
animation: typing 1.4s infinite;
}

.typing-indicator span:nth-child(2) {
animation-delay: 0.2s;
}

.typing-indicator span:nth-child(3) {
animation-delay: 0.4s;
}

@keyframes typing {
0%, 60%, 100% {
    transform: translateY(0);
    opacity: 0.5;
}
30% {
    transform: translateY(-10px);
    opacity: 1;
}
}
`;
document.head.appendChild(style);


// 页面加载时初始化聊天模块
document.addEventListener('DOMContentLoaded', function () {
    // 立即加载聊天数据（不等待切换到聊天模块）
    console.log('页面加载完成，预加载聊天数据');

    // 预加载聊天数据但不完全初始化
    try {
        const savedContacts = localStorage.getItem('chatContacts');
        const savedGroups = localStorage.getItem('chatGroups');
        const savedHistory = localStorage.getItem('chatHistory');

        if (savedContacts) {
            contacts = JSON.parse(savedContacts) || [];
        }
        if (savedGroups) {
            groups = JSON.parse(savedGroups) || [];
        }
        if (savedHistory) {
            chatHistory = JSON.parse(savedHistory) || {};
        }

        console.log(`预加载完成: ${contacts.length} 个联系人, ${groups.length} 个群组`);
    } catch (error) {
        console.error('预加载聊天数据失败:', error);
    }

    // 原有的其他初始化代码...
    // 加载记忆池
    CharacterMemoryPool.load();

    // 添加时间显示
    setInterval(() => {
        const timeInfo = getBeijingTime();
        console.log('当前北京时间：', timeInfo.full.toLocaleString('zh-CN'));
    }, 60000);
});


// 导出函数供外部调用
window.chatModule = {
    init: initChatModule,
    sendMessage: sendChatMessage,
    selectContact: selectContact,
    showAddFriend: showAddFriend,
    showCreateGroup: showCreateGroup,
    exportChat: exportChat,
    editContact: editContact,
    deleteContact: deleteContact
};
// 导出、编辑、删除功能执行后关闭菜单   新增
const originalExportChat = window.exportChat;
window.exportChat = function () {
    if (originalExportChat) originalExportChat();
    const menu = document.getElementById('chatDropdownMenu');
    if (menu) menu.style.display = 'none';
};

const originalEditContact = window.editContact;
window.editContact = function () {
    if (originalEditContact) originalEditContact();
    const menu = document.getElementById('chatDropdownMenu');
    if (menu) menu.style.display = 'none';
};

const originalDeleteContact = window.deleteContact;
window.deleteContact = function () {
    if (originalDeleteContact) originalDeleteContact();
    const menu = document.getElementById('chatDropdownMenu');
    if (menu) menu.style.display = 'none';
};

// 监听窗口大小变化   新增
window.addEventListener('resize', function () {
    if (window.innerWidth > 768) {
        // 桌面端：显示两个视图
        const listView = document.getElementById('chatListView');
        const conversationView = document.getElementById('chatConversationView');
        if (listView) listView.style.display = 'flex';
        if (conversationView && currentChatId) {
            conversationView.style.display = 'flex';
        }
    }
});

// 头像上传预览功能
document.getElementById('friendAvatar')?.addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (event) {
            const preview = document.querySelector('#addFriendModal .avatar-preview');
            if (preview) {
                preview.innerHTML = `<img src="${event.target.result}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
            }
        };
        reader.readAsDataURL(file);
    }
});
function scrollToBottom() {
    const messagesContainer = document.getElementById('chatMessagesContainer');
    if (messagesContainer) {
        requestAnimationFrame(() => {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        });
    }
}



// ==================== 卡片系统功能模块 ====================

// 卡片系统数据存储
let cardTemplates = [];
let currentCard = null;
let parsedHTMLContent = null;
let identifiedFields = [];

// 初始化卡片系统
function initCardSystem() {
    loadCards();
    loadCharactersForCards();
}

// 加载卡片数据
function loadCards() {
    const saved = localStorage.getItem('cardTemplates');
    if (saved) {
        cardTemplates = JSON.parse(saved);
    }
}

// 保存卡片数据
function saveCards() {
    localStorage.setItem('cardTemplates', JSON.stringify(cardTemplates));
}

// 显示卡片列表
function showCardsList() {
    document.getElementById('cards-import').style.display = 'none';
    const listPanel = document.getElementById('cards-list');
    listPanel.style.display = 'block';
    renderCardsList();
}
// 编辑卡片绑定的角色
function editCardCharacters(cardId) {
    event.stopPropagation(); // 阻止触发卡片预览

    const card = cardTemplates.find(c => c.id === cardId);
    if (!card) return;

    // 创建编辑弹窗
    const modal = document.createElement('div');
    modal.className = 'card-modal-overlay';
    modal.style.display = 'flex';
    modal.innerHTML = `
<div class="card-modal-content">
    <div class="card-modal-header">
        <h3>编辑绑定角色 - ${card.name}</h3>
        <button class="modal-close" onclick="this.closest('.card-modal-overlay').remove()">×</button>
    </div>
    <div class="card-modal-body">
        <p style="margin-bottom: 15px; color: #666;">选择要绑定到此卡片的角色：</p>
        <div class="card-character-grid" id="editCardCharacterGrid">
            <!-- 动态生成角色列表 -->
        </div>
    </div>
    <div class="modal-footer">
        <button class="btn-cancel" onclick="this.closest('.card-modal-overlay').remove()">取消</button>
        <button class="btn-confirm" onclick="saveCardCharacterBindings('${cardId}')">保存</button>
    </div>
</div>
`;

    document.body.appendChild(modal);

    // 加载角色列表
    const grid = document.getElementById('editCardCharacterGrid');
    const savedContacts = localStorage.getItem('chatContacts');
    const contacts = savedContacts ? JSON.parse(savedContacts) : [];

    if (contacts.length === 0) {
        grid.innerHTML = '<p style="color: #999;">暂无角色，请先在聊天模块添加好友</p>';
        return;
    }

    grid.innerHTML = contacts.map(contact => `
<div class="card-character-item ${card.boundCharacters.includes(contact.name) ? 'selected' : ''}" 
     data-char-id="${contact.id}" 
     data-char-name="${contact.name}"
     onclick="toggleEditCardCharacter('${contact.id}')">
    <img src="${contact.avatar}" style="width: 50px; height: 50px; border-radius: 50%;">
    <span style="font-size: 12px; margin-top: 5px;">${contact.name}</span>
</div>
`).join('');
}

// 切换编辑卡片角色选择
function toggleEditCardCharacter(charId) {
    const item = document.querySelector(`#editCardCharacterGrid [data-char-id="${charId}"]`);
    if (item) {
        item.classList.toggle('selected');
    }
}

// 保存卡片角色绑定
function saveCardCharacterBindings(cardId) {
    const card = cardTemplates.find(c => c.id === cardId);
    if (!card) return;

    // 获取选中的角色
    const selectedCharacters = [];
    document.querySelectorAll('#editCardCharacterGrid .card-character-item.selected').forEach(item => {
        const charName = item.dataset.charName;
        if (charName) {
            selectedCharacters.push(charName);
        }
    });

    // 更新卡片的绑定角色
    card.boundCharacters = selectedCharacters;
    card.updatedAt = new Date().toISOString();

    // 保存到本地存储
    saveCards();

    // 关闭弹窗
    document.querySelector('.card-modal-overlay').remove();

    // 刷新列表显示
    renderCardsList();

    alert('角色绑定已更新');
}

// 渲染卡片列表
function renderCardsList() {
    const grid = document.getElementById('cardsGrid');

    if (cardTemplates.length === 0) {
        grid.innerHTML = '<p style="color: #999; text-align: center; width: 100%;">暂无卡片，点击"导入"添加第一张</p>';
        return;
    }

    grid.innerHTML = cardTemplates.map(card => `
<div class="card-item" onclick="previewCard('${card.id}')">
    <div class="card-icon">🎴</div>
    <div class="card-title">${card.name}</div>
    <div class="card-info">关键词: ${card.keyword}</div>
    <div class="card-info">类型: ${card.type || '自定义'}</div>
    <div class="card-characters">
        ${card.boundCharacters.length > 0 ?
            card.boundCharacters.map(char => `<span class="card-character-tag">${char}</span>`).join('') :
            '<span style="color: #999; font-size: 12px;">未绑定角色</span>'
        }
    </div>
    <div style="position: absolute; top: 10px; right: 10px; display: flex; gap: 5px;">
<button class="card-edit-btn" 
    style="width: 30px; height: 30px; border: none; background: rgba(102, 126, 234, 0.9); color: white; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px; opacity: 0; transition: all 0.3s;"
    onclick="editCardCharacters('${card.id}')" 
    title="编辑绑定角色">
✏️
</button>
<button class="card-delete-btn" onclick="event.stopPropagation(); deleteCard('${card.id}')">
🗑️
</button>
</div>
</div>
`).join('');
}

// 显示导入卡片界面
function showImportCard() {
    document.getElementById('cards-list').style.display = 'none';
    document.getElementById('cards-import').style.display = 'block';
    resetCardForm();
    loadCharactersForCards();
}

// 重置卡片表单
function resetCardForm() {
    document.getElementById('cardName').value = '';
    document.getElementById('cardKeyword').value = '卡片:';
    document.getElementById('cardFileName').textContent = '';
    document.getElementById('dynamicFieldsPreview').style.display = 'none';
    parsedHTMLContent = null;
    identifiedFields = [];
    currentCard = null;

    document.querySelectorAll('.card-character-item').forEach(item => {
        item.classList.remove('selected');
    });
}

// 加载角色列表
function loadCharactersForCards() {
    const grid = document.getElementById('cardCharacterGrid');
    const savedContacts = localStorage.getItem('chatContacts');
    const contacts = savedContacts ? JSON.parse(savedContacts) : [];

    if (contacts.length === 0) {
        grid.innerHTML = '<p style="color: #999;">暂无角色，请先在聊天模块添加好友</p>';
        return;
    }

    grid.innerHTML = contacts.map(contact => `
<div class="card-character-item" data-char-id="${contact.id}" onclick="toggleCardCharacter('${contact.id}')">
    <img src="${contact.avatar}" style="width: 50px; height: 50px; border-radius: 50%;">
    <span style="font-size: 12px; margin-top: 5px;">${contact.name}</span>
</div>
`).join('');
}

// 切换角色选择
function toggleCardCharacter(charId) {
    const item = document.querySelector(`[data-char-id="${charId}"]`);
    if (item) {
        item.classList.toggle('selected');
    }
}

// 处理HTML文件上传
function handleCardFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.html') && !file.name.endsWith('.htm')) {
        alert('请上传HTML格式的文件');
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        parsedHTMLContent = e.target.result;
        document.getElementById('cardFileName').textContent = file.name;

        // 智能识别动态字段
        identifyDynamicFields(parsedHTMLContent);

        // 自动填充卡片名称
        if (!document.getElementById('cardName').value) {
            const fileName = file.name.replace(/\.(html|htm)$/i, '');
            document.getElementById('cardName').value = fileName;
            document.getElementById('cardKeyword').value = `卡片:${fileName}`;
        }
    };
    reader.readAsText(file);
}

// 智能识别动态字段
function identifyDynamicFields(htmlContent) {
    identifiedFields = [];

    // 识别模式
    const patterns = [
        { name: 'time', regex: /\d{2}:\d{2}/g, type: 'time' },
        { name: 'date', regex: /\d{4}-\d{2}-\d{2}/g, type: 'date' },
        { name: 'location', regex: /📍\s*([^<]+)/g, type: 'location' },
        { name: 'distance', regex: /[\d.]+\s*km/g, type: 'distance' },
        { name: 'avatar', regex: /<div[^>]*avatar[^>]*>(.{1,2})<\/div>/gi, type: 'avatar' },
        { name: 'thought', regex: /<p[^>]*>((?!<\/p>).{10,})<\/p>/gi, type: 'thought' },
        { name: 'name', regex: />(测|月|[^<]{1,4})</g, type: 'name' }
    ];

    patterns.forEach(pattern => {
        let matches = htmlContent.matchAll(pattern.regex);
        for (let match of matches) {
            const value = match[1] || match[0];
            if (!identifiedFields.find(f => f.value === value)) {
                identifiedFields.push({
                    type: pattern.type,
                    name: pattern.name,
                    value: value.substring(0, 50),
                    position: match.index
                });
            }
        }
    });

    // 显示识别结果
    if (identifiedFields.length > 0) {
        document.getElementById('dynamicFieldsPreview').style.display = 'block';
        document.getElementById('dynamicFieldsList').innerHTML = identifiedFields.map(field => `
    <div class="dynamic-field-item">
        <span class="dynamic-field-name">${field.type}</span>
        <span class="dynamic-field-preview">${field.value}</span>
    </div>
`).join('');
    }
}

// 保存卡片
function saveCard() {
    const name = document.getElementById('cardName').value.trim();
    const keyword = document.getElementById('cardKeyword').value.trim();

    if (!name) {
        alert('请输入卡片名称');
        return;
    }

    if (!parsedHTMLContent) {
        alert('请上传HTML文件');
        return;
    }

    // 检查名称唯一性
    if (cardTemplates.find(c => c.name === name && (!currentCard || c.id !== currentCard.id))) {
        alert('卡片名称已存在，请使用其他名称');
        return;
    }

    // 获取选中的角色
    const selectedCharacters = [];
    document.querySelectorAll('.card-character-item.selected').forEach(item => {
        const charId = item.dataset.charId;
        const charName = item.querySelector('span').textContent;
        selectedCharacters.push(charName);
    });

    // 创建卡片对象
    const card = {
        id: currentCard ? currentCard.id : 'card_' + Date.now(),
        name: name,
        keyword: keyword,
        htmlContent: parsedHTMLContent,
        dynamicFields: identifiedFields,
        boundCharacters: selectedCharacters,
        type: detectCardType(parsedHTMLContent),
        createdAt: currentCard ? currentCard.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    if (currentCard) {
        // 更新现有卡片
        const index = cardTemplates.findIndex(c => c.id === currentCard.id);
        if (index !== -1) {
            cardTemplates[index] = card;
        }
    } else {
        // 添加新卡片
        cardTemplates.push(card);
    }

    saveCards();
    alert('卡片保存成功！');
    showCardsList();
}

// 检测卡片类型
function detectCardType(htmlContent) {
    if (htmlContent.includes('位置') || htmlContent.includes('location')) return '位置共享';
    if (htmlContent.includes('日记') || htmlContent.includes('diary')) return '日记';
    if (htmlContent.includes('备忘') || htmlContent.includes('memo')) return '备忘录';
    if (htmlContent.includes('游戏') || htmlContent.includes('game')) return '游戏';
    return '自定义';
}

// 预览卡片
function previewCard(cardId) {
    const card = cardTemplates.find(c => c.id === cardId);
    if (!card) return;

    const modal = document.getElementById('cardPreviewModal');
    const content = document.getElementById('cardPreviewContent');

    // 生成预览内容
    let previewHTML = card.htmlContent;

    // 替换动态字段为示例内容
    if (card.dynamicFields.length > 0) {
        previewHTML = `
    <div style="margin-bottom: 20px; padding: 10px; background: #f0f0f0; border-radius: 8px;">
        <strong>动态字段预览（实际使用时会根据角色生成）</strong>
    </div>
    ${previewHTML}
`;
    }

    content.innerHTML = previewHTML;
    modal.style.display = 'flex';
}

// 关闭预览
function closeCardPreview() {
    document.getElementById('cardPreviewModal').style.display = 'none';
}

// 删除卡片
function deleteCard(cardId) {
    if (!confirm('确定要删除这张卡片吗？')) return;

    cardTemplates = cardTemplates.filter(c => c.id !== cardId);
    saveCards();
    renderCardsList();
    alert('卡片已删除');
}

// 取消导入
function cancelImportCard() {
    if (confirm('确定要取消吗？未保存的内容将会丢失。')) {
        showCardsList();
    }
}

// ==================== 聊天集成功能 ====================

// 在聊天中检测卡片关键词
function checkCardKeyword(message, contactId) {
    // 查找当前联系人绑定的卡片
    const contact = contacts.find(c => c.id === contactId) ||
        groups.find(g => g.id === contactId);

    if (!contact) return null;

    // 检查是否匹配卡片关键词
    for (let card of cardTemplates) {
        if (message === card.keyword && card.boundCharacters.includes(contact.name)) {
            return card;
        }
    }

    return null;
}

// 生成个性化卡片内容
async function generatePersonalizedCard(card, contact) {
    let htmlContent = card.htmlContent;

    // 根据卡片类型生成内容
    if (card.type === '位置共享') {
        htmlContent = await generateLocationCard(htmlContent, contact);
    } else if (card.type === '日记') {
        htmlContent = await generateDiaryCard(htmlContent, contact);
    } else if (card.type === '备忘录') {
        htmlContent = await generateMemoCard(htmlContent, contact);
    } else {
        // 通用处理
        htmlContent = await generateGenericCard(htmlContent, contact);
    }

    return htmlContent;
}

// 生成位置共享卡片
async function generateLocationCard(template, contact) {
    // 获取当前时间
    const now = new Date();
    const time = now.toTimeString().slice(0, 5);

    // 生成随机距离
    const distance = (Math.random() * 5 + 0.5).toFixed(1);

    // 替换动态内容
    let html = template;
    html = html.replace(/\d{2}:\d{2}/g, time);
    html = html.replace(/[\d.]+\s*km/g, `${distance} km`);

    // 使用AI生成角色的想法
    const thought = await getAICardContent(contact, '位置共享时的想法', '简短表达你现在在哪里，在做什么');

    // 替换想法内容
    html = html.replace(/<p[^>]*>(.*?)<\/p>/gi, (match, content) => {
        if (content.length > 20) {
            return `<p style="margin:0;">${thought}</p>`;
        }
        return match;
    });

    return html;
}

// 生成日记卡片
async function generateDiaryCard(template, contact) {
    const diaryContent = await getAICardContent(contact, '日记', '写一篇今天的日记，包含心情和发生的事');

    // 替换主要内容区域
    let html = template;
    html = html.replace(/<div[^>]*class="content"[^>]*>.*?<\/div>/gi,
        `<div class="content">${diaryContent}</div>`);

    return html;
}

// 生成备忘录卡片
async function generateMemoCard(template, contact) {
    const memoContent = await getAICardContent(contact, '备忘录', '列出最近要做的几件事');

    let html = template;
    html = html.replace(/<ul[^>]*>.*?<\/ul>/gi,
        `<ul>${memoContent}</ul>`);

    return html;
}

// 通用卡片生成
async function generateGenericCard(template, contact) {
    // 替换名称
    let html = template;
    html = html.replace(/{{name}}/g, contact.name);

    // 替换时间
    const now = new Date();
    html = html.replace(/{{time}}/g, now.toTimeString().slice(0, 5));
    html = html.replace(/{{date}}/g, now.toLocaleDateString());

    return html;
}

// 调用AI生成卡片内容
async function getAICardContent(contact, cardType, prompt) {
    try {
        // 从API配置获取设置
        const provider = document.getElementById('provider')?.value;
        const apiUrl = document.getElementById('apiUrl')?.value;
        const apiKey = document.getElementById('apiKey')?.value;
        const model = document.getElementById('model')?.value;

        if (!apiUrl || !apiKey || !model) {
            return `这是${contact.name}的${cardType}内容`;
        }

        const systemPrompt = `你是${contact.name}，${contact.background || ''}。现在要生成${cardType}内容。`;

        let response;
        if (provider === 'google') {
            response = await fetch(`${apiUrl}/models/${model}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: `${systemPrompt}\n\n${prompt}` }] }],
                    generationConfig: { temperature: 0.7, maxOutputTokens: 200 }
                })
            });

            if (response.ok) {
                const data = await response.json();
                return data.candidates?.[0]?.content?.parts?.[0]?.text || '默认内容';
            }
        } else {
            response = await fetch(`${apiUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.7,
                    max_tokens: 200
                })
            });

            if (response.ok) {
                const data = await response.json();
                return data.choices?.[0]?.message?.content || '默认内容';
            }
        }

        return `${contact.name}的${cardType}`;
    } catch (error) {
        console.error('生成卡片内容失败:', error);
        return `${contact.name}的${cardType}`;
    }
}

// 修改原有的sendChatMessage函数，添加卡片检测
const originalSendChatMessage = sendChatMessage;
sendChatMessage = async function () {
    const input = document.getElementById('chatInputField');
    const message = input.value.trim();

    if (!message || !currentChatId) return;

    // 检测是否是卡片关键词
    const card = checkCardKeyword(message, currentChatId);

    if (card) {
        // 发送用户消息
        addMessageToUI('user', message, new Date().toLocaleTimeString(), true);
        saveMessageToHistory(currentChatId, 'user', message);
        input.value = '';
        input.style.height = 'auto';

        // 生成并发送卡片
        const contact = contacts.find(c => c.id === currentChatId) ||
            groups.find(g => g.id === currentChatId);

        if (contact) {
            // 显示AI正在准备卡片
            showAITyping();

            // 生成个性化卡片内容
            const personalizedCard = await generatePersonalizedCard(card, contact);

            // 移除输入状态
            hideAITyping();

            // 创建卡片消息
            const cardMessage = `
        <div class="card-message" onclick="showCardContent('${card.id}', '${currentChatId}')">
            <div class="card-message-title">🎴 ${card.name}</div>
            <div class="card-message-preview">点击查看</div>
        </div>
    `;

            // 添加到聊天界面
            addMessageToUI('ai', cardMessage, new Date().toLocaleTimeString(), true);

            // 保存卡片内容供查看
            sessionStorage.setItem(`card_${card.id}_${currentChatId}`, personalizedCard);

            // 保存到历史
            saveMessageToHistory(currentChatId, 'ai', `[卡片: ${card.name}]`);
            updateContactLastMessage(currentChatId, `[卡片: ${card.name}]`);
        }
    } else {
        // 正常发送消息
        originalSendChatMessage();
    }
};

// 显示卡片内容
function showCardContent(cardId, contactId) {
    const content = sessionStorage.getItem(`card_${cardId}_${contactId}`);
    if (!content) return;

    // 创建模态框显示卡片
    const modal = document.createElement('div');
    modal.className = 'card-modal-overlay';
    modal.style.display = 'flex';
    modal.innerHTML = `
<div class="card-modal-content" style="max-width: 90%; width: auto;">
    <div class="card-modal-header">
        <h3>卡片内容</h3>
        <button class="modal-close" onclick="this.closest('.card-modal-overlay').remove()">×</button>
    </div>
    <div class="card-modal-body">
        ${content}
    </div>
</div>
`;

    document.body.appendChild(modal);
}

// 页面加载时初始化卡片系统
document.addEventListener('DOMContentLoaded', function () {
    // 当点击设置导航项时初始化卡片系统
    const cardsTab = document.querySelector('[onclick*="showSettingsTab(\'cards\')"]');
    if (cardsTab) {
        const originalClick = cardsTab.onclick;
        cardsTab.onclick = function () {
            if (originalClick) originalClick.call(this);
            initCardSystem();
        };
    }
});
// ==================== 世界书功能模块 ====================

// 世界书数据存储
let worldBooks = [];
let currentWorldBook = null;

// 初始化世界书功能
function initWorldBookModule() {
    loadWorldBooks();
    loadCharactersForWorldBook();
}

// 加载世界书数据
function loadWorldBooks() {
    const saved = localStorage.getItem('worldBooks');
    if (saved) {
        worldBooks = JSON.parse(saved);
    } else {
        // 添加默认世界书示例
        worldBooks = [
            {
                id: 'wb_default',
                name: '现代都市',
                content: '这是一个现代化的都市背景，科技发达，生活便利...',
                characters: [],
                createdAt: new Date().toISOString()
            }
        ];
        saveWorldBooks();
    }
}

// 保存世界书数据
function saveWorldBooks() {
    localStorage.setItem('worldBooks', JSON.stringify(worldBooks));
}

// 显示设置标签页
function showSettingsTab(tabName) {
    // 隐藏所有标签页
    document.querySelectorAll('.settings-tab').forEach(tab => {
        tab.classList.remove('active');
    });

    // 移除所有导航项的激活状态
    document.querySelectorAll('.settings-nav-item').forEach(item => {
        item.classList.remove('active');
    });

    // 显示选中的标签页
    const selectedTab = document.getElementById(`${tabName}-tab`);
    if (selectedTab) {
        selectedTab.classList.add('active');
    }

    // 激活对应的导航项
    event.target.closest('.settings-nav-item').classList.add('active');

    // 如果是世界书标签，初始化
    if (tabName === 'worldbook') {
        initWorldBookModule();
    }
}

// 显示世界书列表
function showWorldbookList() {
    // 隐藏创建面板
    document.getElementById('worldbook-create').style.display = 'none';

    // 显示列表面板
    const listPanel = document.getElementById('worldbook-list');
    listPanel.style.display = 'block';

    // 渲染世界书列表
    renderWorldBookList();
}


// 渲染世界书列表
function renderWorldBookList() {
    const grid = document.getElementById('worldbookGrid');

    if (worldBooks.length === 0) {
        grid.innerHTML = '<p style="color: #999; text-align: center; width: 100%;">暂无世界书，点击"新建"创建第一本</p>';
        return;
    }

    grid.innerHTML = worldBooks.map(wb => `
<div class="worldbook-card" onclick="viewWorldBook('${wb.id}')" title="点击查看详情">
    <div class="wb-card-icon">📚</div>
    <div class="wb-card-title">${wb.name}</div>
    <div class="wb-card-info">
        创建时间：${new Date(wb.createdAt).toLocaleDateString()}
    </div>
    <div class="wb-card-info">
        内容长度：${wb.content.length} 字
    </div>
    <div class="wb-card-characters">
        ${wb.characters.length > 0 ?
            wb.characters.map(char => `<span class="wb-character-tag">${char}</span>`).join('') :
            '<span style="color: #999; font-size: 12px;">未绑定角色</span>'
        }
    </div>
    <button class="wb-delete-btn" onclick="event.stopPropagation(); deleteWorldBook('${wb.id}')">
        <span>🗑️</span>
    </button>
</div>
`).join('');
}

// 删除世界书函数
function deleteWorldBook(worldBookId) {
    if (!confirm('确定要删除这本世界书吗？删除后无法恢复。')) {
        return;
    }

    // 从数组中移除
    worldBooks = worldBooks.filter(wb => wb.id !== worldBookId);

    // 保存到本地存储
    saveWorldBooks();

    // 重新渲染列表
    renderWorldBookList();

    // 显示提示
    alert('世界书已删除');
}

// 显示创建世界书界面
// 显示创建世界书界面
function showCreateWorldbook(isEdit = false) {
    // 隐藏列表面板
    document.getElementById('worldbook-list').style.display = 'none';

    // 显示创建面板
    document.getElementById('worldbook-create').style.display = 'block';

    // 更新标题
    const panelTitle = document.querySelector('#worldbook-create h3');
    if (panelTitle) {
        panelTitle.textContent = isEdit ? '编辑世界书' : '新建世界书';
    }

    // 更新按钮文字
    const saveBtn = document.querySelector('.wb-btn-save');
    if (saveBtn) {
        saveBtn.textContent = isEdit ? '保存修改' : '保存';
    }

    // 如果不是编辑模式，重置表单
    if (!isEdit) {
        resetWorldBookForm();
        // 加载角色列表
        loadCharactersForWorldBook();
    }
}

// 重置世界书表单
function resetWorldBookForm() {
    document.getElementById('wbName').value = '';
    document.getElementById('wbContent').value = '';
    document.getElementById('charCount').textContent = '0';
    document.getElementById('fileName').textContent = '';
    currentWorldBook = null;

    // 重置输入方式选择
    switchWbInput('text');

    // 清除角色选择
    document.querySelectorAll('.character-select-item').forEach(item => {
        item.classList.remove('selected');
    });
}

// 加载角色列表用于绑定
function loadCharactersForWorldBook() {
    const grid = document.getElementById('characterSelectGrid');

    // 从聊天模块获取联系人列表
    const savedContacts = localStorage.getItem('chatContacts');
    const contacts = savedContacts ? JSON.parse(savedContacts) : [];

    if (contacts.length === 0) {
        grid.innerHTML = '<p style="color: #999; text-align: center; width: 100%;">暂无角色，请先在聊天模块添加好友</p>';
        return;
    }

    grid.innerHTML = contacts.map(contact => `
<div class="character-select-item" data-character-id="${contact.id}" onclick="toggleCharacterSelection('${contact.id}')">
    <img src="${contact.avatar}" class="character-avatar-small" alt="${contact.name}">
    <span class="character-name-small">${contact.name}</span>
</div>
`).join('');
}

// 切换角色选择状态
function toggleCharacterSelection(characterId) {
    const item = document.querySelector(`[data-character-id="${characterId}"]`);
    if (item) {
        item.classList.toggle('selected');
    }
}

// 切换输入方式
function switchWbInput(type, event = null) {
    // 切换按钮状态
    document.querySelectorAll('.wb-tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // 如果有事件对象，则使用事件目标；否则跳过
    if (event && event.target) {
        event.target.classList.add('active');
    }

    // 切换输入面板
    if (type === 'text') {
        document.getElementById('wb-text-input').style.display = 'block';
        document.getElementById('wb-file-input').style.display = 'none';
    } else {
        document.getElementById('wb-text-input').style.display = 'none';
        document.getElementById('wb-file-input').style.display = 'block';
    }
}

// 监听文字输入字数
document.addEventListener('DOMContentLoaded', function () {
    const contentTextarea = document.getElementById('wbContent');
    if (contentTextarea) {
        contentTextarea.addEventListener('input', function () {
            document.getElementById('charCount').textContent = this.value.length;
        });
    }

    // 文件上传处理
    const fileInput = document.getElementById('wbFile');
    if (fileInput) {
        fileInput.addEventListener('change', handleWorldBookFileUpload);
    }
});

// 处理世界书文件上传
// 处理世界书文件上传
function handleWorldBookFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== 'application/json') {
        alert('请上传JSON格式的文件');
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = JSON.parse(e.target.result);

            // 检查是否是SillyTavern格式
            if (data.entries && typeof data.entries === 'object') {
                // 处理SillyTavern格式的世界书
                const entries = Object.values(data.entries);
                let combinedContent = '';
                let worldBookName = file.name.replace('.json', '');

                // 合并所有条目的内容
                entries.forEach(entry => {
                    if (entry.comment) {
                        combinedContent += `【${entry.comment}】\n`;
                    }
                    if (entry.content) {
                        combinedContent += entry.content + '\n\n';
                    }
                });

                // 填充表单
                document.getElementById('wbName').value = worldBookName;
                document.getElementById('wbContent').value = combinedContent.trim();
                document.getElementById('charCount').textContent = combinedContent.length;
                document.getElementById('fileName').textContent = file.name;

            } else if (data.name && data.content) {
                // 处理标准格式
                document.getElementById('wbName').value = data.name;
                document.getElementById('wbContent').value = data.content;
                document.getElementById('charCount').textContent = data.content.length;
                document.getElementById('fileName').textContent = file.name;

            } else {
                alert('文件格式错误，请确保是有效的世界书文件');
                return;
            }

            // 切换到文字输入显示内容
            switchWbInput('text');

        } catch (error) {
            alert('文件解析失败：' + error.message);
        }
    };
    reader.readAsText(file);
}

// 保存世界书
async function saveWorldbook() {
    const name = document.getElementById('wbName').value.trim();
    const content = document.getElementById('wbContent').value.trim();

    if (!name) {
        alert('请输入世界书名称');
        return;
    }

    if (!content) {
        alert('请输入世界书内容');
        return;
    }

    if (content.length > 30000) {
        alert('世界书内容不能超过30000字');
        return;
    }

    // 获取选中的角色
    const selectedCharacters = [];
    document.querySelectorAll('.character-select-item.selected').forEach(item => {
        const characterId = item.dataset.characterId;
        const characterName = item.querySelector('.character-name-small').textContent;
        selectedCharacters.push(characterName);
    });

    // 创建或更新世界书
    const worldBook = {
        id: currentWorldBook ? currentWorldBook.id : 'wb_' + Date.now(),
        name: name,
        content: content,
        characters: selectedCharacters,
        createdAt: currentWorldBook ? currentWorldBook.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    if (currentWorldBook) {
        // 更新现有世界书
        const index = worldBooks.findIndex(wb => wb.id === currentWorldBook.id);
        if (index !== -1) {
            worldBooks[index] = worldBook;
        }
    } else {
        // 添加新世界书
        worldBooks.push(worldBook);
    }

    // 保存到本地存储
    saveWorldBooks();

    // 应用世界书到绑定的角色
    applyWorldBookToCharacters(worldBook);

    alert('世界书保存成功！');

    // 返回列表视图
    showWorldbookList();
}

// 应用世界书到角色
function applyWorldBookToCharacters(worldBook) {
    // 获取所有联系人
    const savedContacts = localStorage.getItem('chatContacts');
    if (!savedContacts) return;

    let contacts = JSON.parse(savedContacts);

    // 更新每个绑定角色的背景设定
    contacts.forEach(contact => {
        if (worldBook.characters.includes(contact.name)) {
            // 将世界书内容添加到角色背景
            contact.worldBookId = worldBook.id;
            contact.worldBookContent = worldBook.content;

            // 更新角色的背景设定
            if (!contact.background) {
                contact.background = '';
            }
            contact.background = `[世界设定：${worldBook.name}]\n${worldBook.content}\n\n[角色设定]\n${contact.background}`;
        }
    });

    // 保存更新后的联系人
    localStorage.setItem('chatContacts', JSON.stringify(contacts));
}

// 编辑世界书
// 编辑世界书
function editWorldBook(worldBookId) {
    const worldBook = worldBooks.find(wb => wb.id === worldBookId);
    if (!worldBook) return;

    currentWorldBook = worldBook;

    // 填充表单
    document.getElementById('wbName').value = worldBook.name;
    document.getElementById('wbContent').value = worldBook.content;
    document.getElementById('charCount').textContent = worldBook.content.length;

    // 显示创建面板（编辑模式）
    showCreateWorldbook(true);

    // 选中已绑定的角色
    loadCharactersForWorldBook();
    setTimeout(() => {
        worldBook.characters.forEach(charName => {
            document.querySelectorAll('.character-name-small').forEach(nameElem => {
                if (nameElem.textContent === charName) {
                    nameElem.closest('.character-select-item').classList.add('selected');
                }
            });
        });
    }, 100);
}

// 显示创建面板
showCreateWorldbook();


// 取消创建世界书
function cancelCreateWorldbook() {
    if (confirm('确定要取消吗？未保存的内容将会丢失。')) {
        showWorldbookList();
    }
}

// 导出世界书
function exportWorldBook(worldBookId) {
    const worldBook = worldBooks.find(wb => wb.id === worldBookId);
    if (!worldBook) return;

    const dataStr = JSON.stringify(worldBook, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

    const exportFileDefaultName = `worldbook_${worldBook.name}_${Date.now()}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
}

// 在页面加载时初始化
document.addEventListener('DOMContentLoaded', function () {
    // 当点击设置导航项时初始化世界书
    const settingsNavItem = document.querySelector('[data-section="settings"]');
    if (settingsNavItem) {
        const originalClick = settingsNavItem.onclick;
        settingsNavItem.onclick = function () {
            if (originalClick) originalClick.call(this);
            // 默认显示世界书标签
            setTimeout(() => {
                const worldbookTab = document.querySelector('.settings-nav-item');
                if (worldbookTab) worldbookTab.click();
            }, 100);
        };
    }
});
// 查看世界书详情
function viewWorldBook(worldBookId) {
    const worldBook = worldBooks.find(wb => wb.id === worldBookId);
    if (!worldBook) return;

    // 创建查看弹窗
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.display = 'flex';
    modal.innerHTML = `
<div class="modal-content" style="max-width: 800px;">
    <div class="modal-header">
        <h3>📚 ${worldBook.name}</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
    </div>
    <div class="modal-body">
        <div class="wb-view-section">
            <label style="font-weight: 600; color: #666; margin-bottom: 10px; display: block;">世界设定内容：</label>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 10px; max-height: 400px; overflow-y: auto; white-space: pre-wrap; line-height: 1.6;">
                ${worldBook.content}
            </div>
        </div>
        
        <div class="wb-view-section" style="margin-top: 20px;">
            <label style="font-weight: 600; color: #666; margin-bottom: 10px; display: block;">绑定的角色：</label>
            <div class="wb-card-characters">
                ${worldBook.characters.length > 0 ?
            worldBook.characters.map(char => `<span class="wb-character-tag" style="margin: 2px;">${char}</span>`).join('') :
            '<span style="color: #999;">未绑定角色</span>'
        }
            </div>
        </div>
        
        <div class="wb-view-section" style="margin-top: 20px;">
            <label style="font-weight: 600; color: #666;">创建时间：</label>
            <span>${new Date(worldBook.createdAt).toLocaleString()}</span>
            ${worldBook.updatedAt ? `
                <br>
                <label style="font-weight: 600; color: #666;">最后修改：</label>
                <span>${new Date(worldBook.updatedAt).toLocaleString()}</span>
            ` : ''}
        </div>
    </div>
    <div class="modal-footer">
        <button class="btn-cancel" onclick="this.closest('.modal-overlay').remove()">关闭</button>
        <button class="btn-confirm" onclick="this.closest('.modal-overlay').remove(); editWorldBook('${worldBook.id}')">
            编辑
        </button>
        <button class="btn-confirm" style="background: #4CAF50;" onclick="exportWorldBook('${worldBook.id}'); this.closest('.modal-overlay').remove();">
            导出
        </button>
    </div>
</div>
`;

    document.body.appendChild(modal);
}





// 10. 添加样式增强
const styleEnhancement = document.createElement('style');
styleEnhancement.textContent = `
.interactive-card {
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
border-radius: 12px;
padding: 15px;
cursor: pointer;
transition: all 0.3s;
position: relative;
overflow: hidden;
}

.interactive-card::before {
content: '';
position: absolute;
top: -50%;
left: -50%;
width: 200%;
height: 200%;
background: linear-gradient(45deg, transparent, rgba(255,255,255,0.1), transparent);
transform: rotate(45deg);
transition: all 0.6s;
}

.interactive-card:hover::before {
animation: shimmer 0.6s ease;
}

@keyframes shimmer {
0% { transform: translateX(-100%) translateY(-100%) rotate(45deg); }
100% { transform: translateX(100%) translateY(100%) rotate(45deg); }
}

.interactive-card:hover {
transform: scale(1.05);
box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4);
}

.card-message-hint {
font-size: 10px;
opacity: 0.8;
margin-top: 5px;
font-style: italic;
}
`;
document.head.appendChild(styleEnhancement);

// 初始化提示
console.log('卡片与AI视觉整合模块已加载完成！');
console.log('功能特性：');
console.log('1. AI可以理解卡片内容');
console.log('2. 支持视觉模型时会"看"卡片');
console.log('3. AI会生成个性化的卡片回应');




// 新增 个人板块
// ==================== AI自主日历功能 ====================
// 在文件末尾添加

// AI决定是否添加日历记录
async function checkAICalendarDecision(message, contact) {
    // 检查消息中的关键词
    const calendarKeywords = ['记住', '明天', '后天', '周末', '生日', '纪念日', '约定', '见面', '聚会'];
    const hasKeyword = calendarKeywords.some(keyword => message.includes(keyword));

    if (hasKeyword && Math.random() > 0.5) { // 50%概率记录
        const calendarContent = await generateAICalendarNote(message, contact);
        if (calendarContent && window.PersonalModule) {
            window.PersonalModule.addAICalendarEvent(
                contact.id,
                contact.name,
                calendarContent,
                detectEventType(calendarContent)
            );
        }
    }
}

// 生成AI日历记录内容
async function generateAICalendarNote(context, contact) {
    try {
        const prompt = `基于对话内容："${context}"，生成一条简短的日历记录（20字以内）`;

        // 这里可以调用AI生成，暂时返回模拟内容
        const templates = [
            `和${currentUserPersona?.name || '朋友'}约定的重要事情`,
            `记得提醒${currentUserPersona?.name || 'TA'}这件事`,
            `${currentUserPersona?.name || '朋友'}说的话要记住`,
            `约好了要一起完成`
        ];

        return templates[Math.floor(Math.random() * templates.length)];
    } catch (error) {
        console.error('生成日历记录失败:', error);
        return null;
    }
}

// 检测事件类型
function detectEventType(content) {
    if (content.includes('生日')) return 'birthday';
    if (content.includes('纪念')) return 'anniversary';
    if (content.includes('节日') || content.includes('节')) return 'holiday';
    if (content.includes('提醒') || content.includes('记得')) return 'reminder';
    return 'normal';
}

// 定期检查纪念日
setInterval(() => {
    if (window.PersonalModule) {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        // 检查所有纪念日类型的事件
        const events = JSON.parse(localStorage.getItem('calendarEvents') || '{}');
        Object.keys(events).forEach(date => {
            events[date].forEach(event => {
                if (event.type === 'anniversary' && event.startDate) {
                    const start = new Date(event.startDate);
                    const years = today.getFullYear() - start.getFullYear();
                    const months = today.getMonth() - start.getMonth();
                    const days = today.getDate() - start.getDate();

                    // 计算总天数
                    const totalDays = Math.floor((today - start) / (1000 * 60 * 60 * 24));

                    // 每个月提醒
                    if (days === start.getDate() && totalDays > 0) {
                        console.log(`纪念日提醒：${event.content}，已经${totalDays}天了`);
                    }
                }
            });
        });
    }
}, 60000); // 每分钟检查一次