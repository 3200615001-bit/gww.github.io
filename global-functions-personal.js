// global-functions-personal.js - 全局函数补充

// 确保 showSection 函数存在
if (typeof window.showSection === 'undefined') {
    window.showSection = function(section) {
        // 隐藏所有模块
        document.querySelectorAll('.module-section').forEach(s => {
            s.classList.remove('active');
        });
        
        // 显示选中的模块
        const targetSection = document.getElementById(`${section}-section`);
        if (targetSection) {
            targetSection.classList.add('active');
        }
        
        // 更新导航状态
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('data-section') === section) {
                item.classList.add('active');
            }
        });
        
        // 如果是设置页面的个人标签，初始化个人模块
        if (section === 'settings') {
            const personalTab = document.querySelector('#personal-tab');
            if (personalTab && personalTab.classList.contains('active')) {
                if (typeof initPersonalModule === 'function') {
                    setTimeout(() => initPersonalModule(), 100);
                }
            }
        }
    };
}

// 确保 showSettingsTab 函数在全局可用
window.showSettingsTab = function(tab) {
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
    if (tab === 'personal' && typeof initPersonalModule === 'function') {
        setTimeout(() => initPersonalModule(), 100);
    }
};

// 确保 showPersonalSection 函数在全局可用
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
            // 添加事件类型改变监听
            const eventTypeSelect = document.getElementById('eventType');
            if (eventTypeSelect && !eventTypeSelect.hasAttribute('data-listener-added')) {
                eventTypeSelect.addEventListener('change', handleEventTypeChange);
                eventTypeSelect.setAttribute('data-listener-added', 'true');
            }
            break;
    }
};

// 页面加载完成后的初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('个人模块全局函数初始化完成');
    
    // 确保事件类型选择器有监听器
    const eventTypeSelect = document.getElementById('eventType');
    if (eventTypeSelect) {
        eventTypeSelect.addEventListener('change', function() {
            if (typeof handleEventTypeChange === 'function') {
                handleEventTypeChange();
            }
        });
    }
    
    // 为所有需要的元素添加事件监听
    const personalTab = document.querySelector('[onclick*="showSettingsTab(\'personal\')"]');
    if (personalTab && !personalTab.hasAttribute('data-listener-added')) {
        personalTab.addEventListener('click', function(e) {
            e.preventDefault();
            showSettingsTab('personal');
        });
        personalTab.setAttribute('data-listener-added', 'true');
    }
});

// 确保所有函数在窗口对象上可用
window.showCreatePersona = window.showCreatePersona || function() {
    if (typeof showCreatePersona === 'function') {
        showCreatePersona();
    }
};

window.changeMonth = window.changeMonth || function(direction) {
    if (typeof changeMonth === 'function') {
        changeMonth(direction);
    }
};

window.switchTransactionView = window.switchTransactionView || function(view) {
    if (typeof switchTransactionView === 'function') {
        switchTransactionView(view);
    }
};

window.switchEventTab = window.switchEventTab || function(tab) {
    if (typeof switchEventTab === 'function') {
        switchEventTab(tab);
    }
};

window.changeCalendarMonth = window.changeCalendarMonth || function(direction) {
    if (typeof changeCalendarMonth === 'function') {
        changeCalendarMonth(direction);
    }
};

window.handleEventTypeChange = window.handleEventTypeChange || function() {
    if (typeof handleEventTypeChange === 'function') {
        handleEventTypeChange();
    }
};