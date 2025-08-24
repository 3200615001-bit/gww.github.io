// personal-fix.js - 完整的个人模块修复补丁

// ==================== 1. 初始化全局变量 ====================
// 确保所有必需的全局变量存在
window.personas = window.personas || [];
window.transactions = window.transactions || [];
window.calendarEvents = window.calendarEvents || {};
window.accountBalance = window.accountBalance || 10000;
window.currentEditingPersona = window.currentEditingPersona || null;
window.currentEditingDate = window.currentEditingDate || null;
window.currentMonth = window.currentMonth || new Date();
window.currentCalendarMonth = window.currentCalendarMonth || new Date();

// ==================== 2. 修复核心函数 ====================

// 修复 showPersonalSection 函数
window.showPersonalSection = function(section, buttonElement) {
    console.log(`切换到个人部分: ${section}`);
    
    try {
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
        } else {
            console.warn(`未找到目标section: ${section}-section`);
            return;
        }
        
        // 更新按钮状态
        document.querySelectorAll('.personal-action-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // 设置当前按钮为激活状态 - 添加安全检查
        if (buttonElement && buttonElement.classList) {
            buttonElement.classList.add('active');
        } else if (typeof event !== 'undefined' && event && event.currentTarget && event.currentTarget.classList) {
            event.currentTarget.classList.add('active');
        } else {
            // 通过 onclick 属性找到对应的按钮
            const btn = document.querySelector(`button[onclick*="showPersonalSection('${section}')"]`);
            if (btn && btn.classList) {
                btn.classList.add('active');
            }
        }
        
        // 记录当前section
        if (window.PersonalModule) {
            window.PersonalModule.currentSection = section;
        }
        
        // 根据不同section执行初始化
        switch(section) {
            case 'persona':
                if (typeof renderPersonaList === 'function') {
                    try {
                        renderPersonaList();
                    } catch (e) {
                        console.error('renderPersonaList 错误:', e);
                    }
                }
                if (typeof loadCharactersForBinding === 'function') {
                    try {
                        loadCharactersForBinding();
                    } catch (e) {
                        console.error('loadCharactersForBinding 错误:', e);
                    }
                }
                break;
                
            case 'account':
                if (typeof updateAccountDisplay === 'function') {
                    try {
                        updateAccountDisplay();
                    } catch (e) {
                        console.error('updateAccountDisplay 错误:', e);
                    }
                }
                if (typeof renderTransactionList === 'function') {
                    try {
                        renderTransactionList();
                    } catch (e) {
                        console.error('renderTransactionList 错误:', e);
                    }
                }
                break;
                
            case 'calendar':
                if (typeof renderCalendar === 'function') {
                    try {
                        renderCalendar();
                    } catch (e) {
                        console.error('renderCalendar 错误:', e);
                    }
                }
                if (typeof renderEventList === 'function') {
                    try {
                        renderEventList();
                    } catch (e) {
                        console.error('renderEventList 错误:', e);
                    }
                }
                // 添加事件类型改变监听
                const eventTypeSelect = document.getElementById('eventType');
                if (eventTypeSelect && !eventTypeSelect.hasAttribute('data-listener-added')) {
                    eventTypeSelect.addEventListener('change', function() {
                        if (typeof handleEventTypeChange === 'function') {
                            handleEventTypeChange();
                        }
                    });
                    eventTypeSelect.setAttribute('data-listener-added', 'true');
                }
                break;
        }
    } catch (error) {
        console.error('showPersonalSection 错误:', error);
    }
};

// 修复 initPersonalModule 函数
window.initPersonalModule = function() {
    console.log('执行修复版 initPersonalModule...');
    
    try {
        // 确保全局变量初始化
        window.personas = window.personas || [];
        window.transactions = window.transactions || [];
        window.calendarEvents = window.calendarEvents || {};
        
        // 加载数据
        if (typeof loadPersonas === 'function') {
            try {
                loadPersonas();
            } catch (e) {
                console.error('loadPersonas 错误:', e);
                // 初始化空数组
                window.personas = [];
            }
        }
        
        if (typeof loadTransactions === 'function') {
            try {
                loadTransactions();
            } catch (e) {
                console.error('loadTransactions 错误:', e);
                // 初始化空数组
                window.transactions = [];
            }
        }
        
        if (typeof loadCalendarEvents === 'function') {
            try {
                loadCalendarEvents();
            } catch (e) {
                console.error('loadCalendarEvents 错误:', e);
                // 初始化空对象
                window.calendarEvents = {};
            }
        }
        
        // 设置默认显示人设页面 - 不传递按钮元素，避免错误
        setTimeout(() => {
            showPersonalSection('persona');
        }, 100);
        
        // 初始化文件上传事件
        const personaAvatar = document.getElementById('personaAvatar');
        if (personaAvatar && !personaAvatar.hasAttribute('data-listener-added')) {
            personaAvatar.addEventListener('change', function(e) {
                if (typeof handleAvatarUpload === 'function') {
                    handleAvatarUpload(e);
                }
            });
            personaAvatar.setAttribute('data-listener-added', 'true');
        }
        
        // 初始化日历提醒检查
        if (typeof checkCalendarReminders === 'function') {
            // 清除之前的定时器（如果有）
            if (window.calendarReminderInterval) {
                clearInterval(window.calendarReminderInterval);
            }
            window.calendarReminderInterval = setInterval(() => {
                try {
                    checkCalendarReminders();
                } catch (e) {
                    console.error('checkCalendarReminders 错误:', e);
                }
            }, 60000);
        }
        
        console.log('个人模块初始化完成');
    } catch (error) {
        console.error('initPersonalModule 主错误:', error);
    }
};

// ==================== 3. 修复其他相关函数 ====================

// 修复 switchTransactionView
window.switchTransactionView = function(view, buttonElement) {
    try {
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        if (buttonElement && buttonElement.classList) {
            buttonElement.classList.add('active');
        } else if (typeof event !== 'undefined' && event && event.target && event.target.classList) {
            event.target.classList.add('active');
        }
        
        if (typeof renderTransactionList === 'function') {
            renderTransactionList(view);
        }
    } catch (error) {
        console.error('switchTransactionView 错误:', error);
    }
};

// 修复 switchEventTab
window.switchEventTab = function(tab, buttonElement) {
    try {
        document.querySelectorAll('.event-tab').forEach(t => {
            t.classList.remove('active');
        });
        
        if (buttonElement && buttonElement.classList) {
            buttonElement.classList.add('active');
        } else if (typeof event !== 'undefined' && event && event.target && event.target.classList) {
            event.target.classList.add('active');
        }
        
        if (typeof renderEventList === 'function') {
            renderEventList(tab);
        }
    } catch (error) {
        console.error('switchEventTab 错误:', error);
    }
};

// 修复 showCreatePersona
window.showCreatePersona = function() {
    console.log('显示创建人设表单');
    
    try {
        // 重置表单
        window.currentEditingPersona = null;
        
        const formTitle = document.getElementById('personaFormTitle');
        if (formTitle) formTitle.textContent = '新建人设';
        
        const nameInput = document.getElementById('personaName');
        if (nameInput) nameInput.value = '';
        
        const bgInput = document.getElementById('personaBackground');
        if (bgInput) bgInput.value = '';
        
        const avatarImg = document.getElementById('personaAvatarImg');
        if (avatarImg) avatarImg.style.display = 'none';
        
        const avatarPlaceholder = document.getElementById('personaAvatarPlaceholder');
        if (avatarPlaceholder) avatarPlaceholder.style.display = 'block';
        
        const maleRadio = document.querySelector('input[name="personaGender"][value="male"]');
        if (maleRadio) maleRadio.checked = true;
        
        // 清空已选择的角色
        document.querySelectorAll('.character-bind-item input[type="checkbox"]').forEach(cb => {
            cb.checked = false;
        });
        
        // 切换显示
        const listSection = document.getElementById('persona-list');
        const formSection = document.getElementById('persona-form');
        
        if (listSection) listSection.style.display = 'none';
        if (formSection) formSection.style.display = 'block';
        
        // 加载可绑定的角色
        if (typeof loadCharactersForBinding === 'function') {
            loadCharactersForBinding();
        }
    } catch (error) {
        console.error('showCreatePersona 错误:', error);
    }
};

// ==================== 4. 确保所有函数在全局可用 ====================

// 辅助函数映射
const functionMappings = [
    'changeMonth', 'changeCalendarMonth', 'handleEventTypeChange',
    'renderPersonaList', 'loadCharactersForBinding', 'updateAccountDisplay',
    'renderTransactionList', 'renderCalendar', 'renderEventList',
    'loadPersonas', 'loadTransactions', 'loadCalendarEvents',
    'checkCalendarReminders', 'handleAvatarUpload'
];

// 为每个函数创建安全的全局引用
functionMappings.forEach(funcName => {
    if (!window[funcName]) {
        window[funcName] = function() {
            console.warn(`函数 ${funcName} 未定义，创建占位函数`);
        };
    }
});

// ==================== 5. DOM 事件监听和修复 ====================

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM加载完成，执行修复...');
    
    // 修复所有带 onclick 的按钮
    setTimeout(() => {
        // 修复个人操作按钮
        document.querySelectorAll('.personal-action-btn').forEach(btn => {
            const onclick = btn.getAttribute('onclick');
            if (onclick) {
                const match = onclick.match(/showPersonalSection\('(.+?)'\)/);
                if (match) {
                    const section = match[1];
                    btn.removeAttribute('onclick');
                    btn.addEventListener('click', function(e) {
                        e.preventDefault();
                        window.showPersonalSection(section, this);
                    });
                }
            }
        });
        
        // 修复切换按钮
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            const onclick = btn.getAttribute('onclick');
            if (onclick) {
                const match = onclick.match(/switchTransactionView\('(.+?)'\)/);
                if (match) {
                    const view = match[1];
                    btn.removeAttribute('onclick');
                    btn.addEventListener('click', function(e) {
                        e.preventDefault();
                        window.switchTransactionView(view, this);
                    });
                }
            }
        });
        
        // 修复事件标签
        document.querySelectorAll('.event-tab').forEach(btn => {
            const onclick = btn.getAttribute('onclick');
            if (onclick) {
                const match = onclick.match(/switchEventTab\('(.+?)'\)/);
                if (match) {
                    const tab = match[1];
                    btn.removeAttribute('onclick');
                    btn.addEventListener('click', function(e) {
                        e.preventDefault();
                        window.switchEventTab(tab, this);
                    });
                }
            }
        });
    }, 500);
});

// ==================== 6. 错误处理 ====================

window.addEventListener('error', function(e) {
    console.error('捕获全局错误:', e.message, '在', e.filename, '行', e.lineno, '列', e.colno);
    
    // 阻止某些已知的循环错误
    if (e.message && e.message.includes('Cannot read properties of undefined')) {
        console.warn('检测到未定义属性错误，已阻止传播');
        e.preventDefault();
        return false;
    }
});

// ==================== 7. 验证函数 ====================

window.validatePersonalModule = function() {
    console.log('=== 个人模块完整验证 ===');
    
    const checks = {
        '全局函数': {
            'showPersonalSection': typeof window.showPersonalSection === 'function',
            'initPersonalModule': typeof window.initPersonalModule === 'function',
            'showCreatePersona': typeof window.showCreatePersona === 'function',
            'switchTransactionView': typeof window.switchTransactionView === 'function',
            'switchEventTab': typeof window.switchEventTab === 'function'
        },
        '全局变量': {
            'PersonalModule对象': typeof window.PersonalModule === 'object',
            'personas数组': Array.isArray(window.personas),
            'transactions数组': Array.isArray(window.transactions),
            'calendarEvents对象': typeof window.calendarEvents === 'object',
            'accountBalance': typeof window.accountBalance === 'number'
        },
        'DOM元素': {
            'personal-tab': document.getElementById('personal-tab') !== null,
            'persona-section': document.getElementById('persona-section') !== null,
            'account-section': document.getElementById('account-section') !== null,
            'calendar-section': document.getElementById('calendar-section') !== null,
            'personaList': document.getElementById('personaList') !== null,
            'transactionList': document.getElementById('transactionList') !== null,
            'calendarDays': document.getElementById('calendarDays') !== null
        }
    };
    
    let totalPassed = 0;
    let totalChecks = 0;
    
    Object.entries(checks).forEach(([category, items]) => {
        console.log(`\n--- ${category} ---`);
        Object.entries(items).forEach(([name, result]) => {
            console.log(`${name}: ${result ? '✓' : '✗'}`);
            totalChecks++;
            if (result) totalPassed++;
        });
    });
    
    const allPassed = totalPassed === totalChecks;
    console.log(`\n总计: ${totalPassed}/${totalChecks} 通过`);
    
    if (allPassed) {
        console.log('✅ 所有检查通过！');
        
        // 尝试初始化
        try {
            window.initPersonalModule();
            console.log('✅ 初始化成功！');
            return true;
        } catch (e) {
            console.error('❌ 初始化失败:', e);
            return false;
        }
    } else {
        console.log('❌ 部分检查未通过，请检查上述失败项');
        
        // 尝试修复缺失的全局变量
        console.log('\n尝试自动修复...');
        if (!Array.isArray(window.personas)) {
            window.personas = [];
            console.log('✓ 已创建 personas 数组');
        }
        if (!Array.isArray(window.transactions)) {
            window.transactions = [];
            console.log('✓ 已创建 transactions 数组');
        }
        if (typeof window.calendarEvents !== 'object') {
            window.calendarEvents = {};
            console.log('✓ 已创建 calendarEvents 对象');
        }
        if (typeof window.accountBalance !== 'number') {
            window.accountBalance = 10000;
            console.log('✓ 已设置 accountBalance 默认值');
        }
        
        console.log('\n请重新运行 validatePersonalModule() 验证修复结果');
        return false;
    }
};

// ==================== 8. 初始化提示 ====================

console.log('%c个人模块修复补丁已加载', 'color: green; font-weight: bold;');
console.log('可用命令:');
console.log('- validatePersonalModule() : 验证并初始化个人模块');
console.log('- showPersonalSection("persona/account/calendar") : 切换个人模块页面');
console.log('- window.personas : 查看人设数据');
console.log('- window.transactions : 查看交易数据');
console.log('- window.calendarEvents : 查看日历事件');

// 自动尝试初始化（延迟执行，确保其他脚本加载完成）
setTimeout(() => {
    if (document.getElementById('personal-tab')) {
        console.log('检测到个人模块DOM，尝试自动初始化...');
        validatePersonalModule();
    }
}, 1000);