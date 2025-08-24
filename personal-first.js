// personal-first.js - 个人模块初始化和辅助功能

// 检查并初始化联系人数据
function checkAndInitializeContacts() {
    const savedContacts = localStorage.getItem('chatContacts');
    
    if (!savedContacts || savedContacts === '[]' || savedContacts === 'null') {
        console.log('创建默认联系人数据...');
        
        const defaultContacts = [
            {
                id: 'ai_assistant',
                name: 'AI助手',
                avatar: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Ccircle cx="50" cy="50" r="50" fill="%23667eea"/%3E%3Ctext x="50" y="55" text-anchor="middle" fill="white" font-size="40"%3EAI%3C/text%3E%3C/svg%3E',
                status: 'online',
                background: '我是您的AI助手，可以陪您聊天、解答问题、提供建议。',
                gender: 'other',
                lastMessage: '点击开始聊天',
                lastTime: '刚刚',
                unread: 0
            }
        ];
        
        localStorage.setItem('chatContacts', JSON.stringify(defaultContacts));
        
        // 同步到全局变量
        if (window.contacts !== undefined) {
            window.contacts = defaultContacts;
        }
        
        console.log('默认联系人创建成功');
    }
}

// 确保 showPersonalSection 函数在全局作用域可用
window.showPersonalSection = function(section) {
    // 隐藏所有section
    const sections = ['persona-section', 'account-section', 'calendar-section'];
    sections.forEach(sectionId => {
        const element = document.getElementById(sectionId);
        if (element) {
            element.style.display = 'none';
        }
    });
    
    // 显示选中的section
    const targetSection = document.getElementById(section + '-section');
    if (targetSection) {
        targetSection.style.display = 'block';
    }
    
    // 更新按钮状态
    document.querySelectorAll('.personal-action-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // 设置当前按钮为激活状态
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }
    
    // 记录当前section
    if (window.PersonalModule) {
        window.PersonalModule.currentSection = section;
    }
    
    // 根据不同section执行初始化
    switch(section) {
        case 'persona':
            if (typeof renderPersonaList === 'function') {
                renderPersonaList();
            }
            if (typeof loadCharactersForBinding === 'function') {
                loadCharactersForBinding();
            }
            break;
        case 'account':
            if (typeof updateAccountDisplay === 'function') {
                updateAccountDisplay();
            }
            if (typeof renderTransactionList === 'function') {
                renderTransactionList();
            }
            break;
        case 'calendar':
            if (typeof renderCalendar === 'function') {
                renderCalendar();
            }
            if (typeof renderEventList === 'function') {
                renderEventList();
            }
            break;
    }
};

// 确保 showSettingsTab 函数在全局作用域可用
window.showSettingsTab = window.showSettingsTab || function(tab) {
    // 隐藏所有标签页
    document.querySelectorAll('.settings-tab').forEach(tabElement => {
        tabElement.classList.remove('active');
        tabElement.style.display = 'none';
    });
    
    // 显示选中的标签页
    const targetTab = document.getElementById(tab + '-tab');
    if (targetTab) {
        targetTab.classList.add('active');
        targetTab.style.display = 'block';
    }
    
    // 更新导航项状态
    document.querySelectorAll('.settings-nav-item').forEach(navItem => {
        navItem.classList.remove('active');
    });
    
    // 设置当前导航项为激活状态
    const currentNavItem = document.querySelector(`[onclick*="showSettingsTab('${tab}')"]`);
    if (currentNavItem) {
        currentNavItem.classList.add('active');
    }
    
    // 如果是个人标签页，初始化个人模块
    if (tab === 'personal') {
        if (typeof initPersonalModule === 'function') {
            initPersonalModule();
        }
    }
};

// AI角色主动消息系统
window.AIMessageSystem = {
    // 检查并发送日历相关消息
    checkCalendarMessages: function() {
        const activePersona = window.PersonalModule?.getActivePersona();
        if (!activePersona || !activePersona.boundCharacters) return;
        
        const today = new Date().toISOString().split('T')[0];
        const calendarEvents = window.PersonalModule?.getCalendarEvents() || {};
        const todayEvents = calendarEvents[today] || [];
        
        // 检查今天的纪念日
        todayEvents.forEach(event => {
            if (event.type === 'anniversary' || event.type === 'birthday') {
                // 随机选择一个绑定的角色发送祝福
                const randomChar = activePersona.boundCharacters[
                    Math.floor(Math.random() * activePersona.boundCharacters.length)
                ];
                
                // 生成祝福消息
                const message = this.generateCelebrationMessage(event, activePersona);
                
                // 添加到聊天记录
                if (window.addChatMessage && typeof window.addChatMessage === 'function') {
                    setTimeout(() => {
                        window.addChatMessage(randomChar.id, message, 'received');
                    }, 3000 + Math.random() * 5000); // 3-8秒后发送
                }
            }
        });
    },
    
    // 生成祝福消息
    generateCelebrationMessage: function(event, persona) {
        const messages = {
            birthday: [
                `🎂 ${persona.name}，生日快乐！愿你今天特别开心~`,
                `🎉 今天是你的生日呢！${persona.name}，要开开心心的哦！`,
                `🎈 生日快乐呀${persona.name}！又长大一岁了呢~`
            ],
            anniversary: [
                `💝 ${persona.name}，今天是${event.content}呢，是个特别的日子~`,
                `🌟 记得今天是${event.content}哦，时间过得真快呀！`,
                `💫 ${event.content}的日子又到了，${persona.name}要记得庆祝一下哦~`
            ]
        };
        
        const messageList = messages[event.type] || [`📅 ${persona.name}，今天有个特别的日子：${event.content}`];
        return messageList[Math.floor(Math.random() * messageList.length)];
    },
    
    // 初始化消息系统
    init: function() {
        // 每小时检查一次
        setInterval(() => {
            this.checkCalendarMessages();
        }, 3600000);
        
        // 启动时检查一次
        setTimeout(() => {
            this.checkCalendarMessages();
        }, 5000);
    }
};

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM 加载完成，初始化个人模块...');
    
    // 检查并初始化联系人数据
    checkAndInitializeContacts();
    
    // 初始化AI消息系统
    if (window.AIMessageSystem) {
        window.AIMessageSystem.init();
    }
    
    // 检查是否在个人设置页面
    const personalSection = document.getElementById('persona-section');
    if (personalSection) {
        console.log('找到个人设置区域，开始初始化...');
        
        if (typeof initPersonalModule === 'function') {
            initPersonalModule();
        } else if (window.PersonalModule && typeof window.PersonalModule.init === 'function') {
            window.PersonalModule.init();
        }
    }
    
    // 绑定设置标签切换事件
    const personalTab = document.querySelector('[onclick*="showSettingsTab(\'personal\')"]');
    if (personalTab) {
        const originalClick = personalTab.onclick;
        personalTab.onclick = function() {
            if (originalClick) originalClick.call(this);
            // 延迟初始化，确保DOM已经更新
            setTimeout(() => {
                if (typeof initPersonalModule === 'function') {
                    initPersonalModule();
                }
            }, 100);
        };
    }
});

// 导出初始化函数到全局
window.initPersonalModule = window.initPersonalModule || function() {
    console.log('执行 initPersonalModule...');
    
    // 检查并初始化联系人
    checkAndInitializeContacts();
    
    // 如果存在原始的初始化函数，调用它们
    if (typeof loadPersonas === 'function') {
        loadPersonas();
    }
    if (typeof loadTransactions === 'function') {
        loadTransactions();
    }
    if (typeof loadCalendarEvents === 'function') {
        loadCalendarEvents();
    }
    
    // 如果 PersonalModule 存在，调用它的 init 方法
    if (window.PersonalModule && typeof window.PersonalModule.init === 'function') {
        window.PersonalModule.init();
    }
};

// 兼容别名
window.initPersonaModule = window.initPersonalModule;

console.log('personal-first.js 加载完成');