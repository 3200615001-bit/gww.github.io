// personal-mobile-enhanced.js - 人设功能增强版修复

(function() {
    'use strict';
    
    console.log('开始加载人设功能增强修复...');
    
    // 等待必要的模块加载
    function waitForModules(callback) {
        let attempts = 0;
        const maxAttempts = 50;
        
        const checkModules = setInterval(() => {
            attempts++;
            
            if (window.personas !== undefined && typeof window.renderPersonaList === 'function') {
                clearInterval(checkModules);
                callback();
            } else if (attempts >= maxAttempts) {
                clearInterval(checkModules);
                console.error('等待模块加载超时');
            }
        }, 100);
    }
    
    // 增强版渲染人设列表函数
    window.renderPersonaList = function() {
        const list = document.getElementById('personaList');
        if (!list) return;
        
        if (!window.personas || window.personas.length === 0) {
            list.innerHTML = '<p style="text-align: center; color: #999; padding: 50px;">暂无人设，点击上方按钮创建</p>';
            return;
        }
        
        list.innerHTML = window.personas.map((persona, index) => `
            <div class="persona-card ${persona.isActive ? 'active' : ''}" data-index="${index}">
                <div class="persona-avatar">
                    <img src="${persona.avatar || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Ccircle cx="50" cy="50" r="50" fill="%23e0e0e0"/%3E%3Ctext x="50" y="55" font-size="40" text-anchor="middle" fill="%23999"%3E👤%3C/text%3E%3C/svg%3E'}" alt="${persona.name}">
                </div>
                <div class="persona-info">
                    <h4>${persona.name}</h4>
                    <p class="persona-gender">${persona.gender === 'male' ? '👨 男' : persona.gender === 'female' ? '👩 女' : '🧑 其他'}</p>
                    <p class="persona-background">${persona.background || '暂无背景描述'}</p>
                    ${persona.boundCharacters && persona.boundCharacters.length > 0 ? 
                        `<div class="bound-characters">
                            <span>绑定角色：</span>
                            ${persona.boundCharacters.map(char => `<span class="char-tag">${char.name}</span>`).join('')}
                        </div>` : ''}
                </div>
                <div class="persona-actions">
                    ${!persona.isActive ? 
                        `<button class="btn-activate" data-action="activate" data-index="${index}">
                            <span class="btn-icon">✨</span>
                            <span class="btn-text">激活</span>
                        </button>` :
                        `<span class="active-badge">
                            <span class="badge-icon">⭐</span>
                            <span class="badge-text">使用中</span>
                        </span>`}
                    <button class="btn-edit" data-action="edit" data-index="${index}">
                        <span class="btn-icon">✏️</span>
                        <span class="btn-text">编辑</span>
                    </button>
                    <button class="btn-delete" data-action="delete" data-index="${index}">
                        <span class="btn-icon">🗑️</span>
                        <span class="btn-text">删除</span>
                    </button>
                </div>
            </div>
        `).join('');
        
        // 绑定事件处理器
        bindPersonaEvents();
    };
    
    // 绑定人设事件（增强版）
    function bindPersonaEvents() {
        const personaList = document.getElementById('personaList');
        if (!personaList) return;
        
        // 移除旧的事件监听器
        const newList = personaList.cloneNode(true);
        personaList.parentNode.replaceChild(newList, personaList);
        
        // 使用事件委托处理所有按钮点击
        newList.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const button = e.target.closest('button[data-action]');
            if (!button) return;
            
            const action = button.getAttribute('data-action');
            const index = parseInt(button.getAttribute('data-index'));
            
            console.log('人设操作:', action, index);
            
            // 添加点击反馈
            button.style.transform = 'scale(0.95)';
            setTimeout(() => {
                button.style.transform = '';
            }, 100);
            
            // 执行对应操作
            handlePersonaAction(action, index);
        });
        
        // 添加触摸事件支持
        if ('ontouchstart' in window) {
            newList.addEventListener('touchstart', function(e) {
                const button = e.target.closest('button[data-action]');
                if (button) {
                    button.classList.add('touching');
                }
            }, { passive: true });
            
            newList.addEventListener('touchend', function(e) {
                const button = e.target.closest('button[data-action]');
                if (button) {
                    button.classList.remove('touching');
                }
            }, { passive: true });
        }
    }
    
    // 处理人设操作
    function handlePersonaAction(action, index) {
        switch (action) {
            case 'activate':
                activatePersona(index);
                break;
            case 'edit':
                editPersona(index);
                break;
            case 'delete':
                deletePersona(index);
                break;
            default:
                console.warn('未知操作:', action);
        }
    }
    
    // 激活人设
    window.activatePersona = function(index) {
        if (!window.personas || !window.personas[index]) {
            console.error('无效的人设索引:', index);
            return;
        }
        
        // 取消其他人设的激活状态
        window.personas.forEach(p => p.isActive = false);
        
        // 激活选中的人设
        window.personas[index].isActive = true;
        
        // 保存到本地存储
        localStorage.setItem('personas', JSON.stringify(window.personas));
        
        // 重新渲染列表
        renderPersonaList();
        
        // 应用到AI系统
        if (typeof window.applyPersonaToAI === 'function') {
            window.applyPersonaToAI(window.personas[index]);
        }
        
        // 显示成功提示
        showNotification(`已切换到人设：${window.personas[index].name}`, 'success');
    };
    
    // 编辑人设
    window.editPersona = function(index) {
        const persona = window.personas[index];
        if (!persona) {
            console.error('无效的人设索引:', index);
            return;
        }
        
        console.log('编辑人设:', persona);
        
        window.currentEditingPersona = persona;
        window.currentEditingIndex = index;
        
        // 填充表单
        const formTitle = document.getElementById('personaFormTitle');
        if (formTitle) formTitle.textContent = '编辑人设';
        
        const nameInput = document.getElementById('personaName');
        if (nameInput) nameInput.value = persona.name;
        
        const bgInput = document.getElementById('personaBackground');
        if (bgInput) bgInput.value = persona.background || '';
        
        // 设置头像
        if (persona.avatar) {
            const avatarImg = document.getElementById('personaAvatarImg');
            const avatarPlaceholder = document.getElementById('personaAvatarPlaceholder');
            if (avatarImg) {
                avatarImg.src = persona.avatar;
                avatarImg.style.display = 'block';
            }
            if (avatarPlaceholder) {
                avatarPlaceholder.style.display = 'none';
            }
        }
        
        // 设置性别
        const genderRadio = document.querySelector(`input[name="personaGender"][value="${persona.gender}"]`);
        if (genderRadio) genderRadio.checked = true;
        
        // 切换显示
        const listSection = document.getElementById('persona-section');
        const formSection = document.getElementById('persona-form');
        
        if (formSection) {
            formSection.style.display = 'block';
            // 确保表单在移动端正确显示
            if (window.innerWidth <= 768) {
                formSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
        
        // 加载可绑定的角色
        if (typeof window.loadCharactersForBinding === 'function') {
            window.loadCharactersForBinding();
            
            // 设置已绑定的角色
            setTimeout(() => {
                if (persona.boundCharacters) {
                    persona.boundCharacters.forEach(char => {
                        const checkbox = document.querySelector(`.character-bind-item input[value="${char.id}"]`);
                        if (checkbox) checkbox.checked = true;
                    });
                }
            }, 100);
        }
    };
    
    // 删除人设
    window.deletePersona = function(index) {
        if (!window.personas || !window.personas[index]) {
            console.error('无效的人设索引:', index);
            return;
        }
        
        const persona = window.personas[index];
        
        // 使用更友好的确认对话框
        showConfirmDialog(
            '删除确认',
            `确定要删除人设"${persona.name}"吗？此操作不可撤销。`,
            () => {
                // 如果删除的是激活的人设，激活第一个其他人设
                if (persona.isActive && window.personas.length > 1) {
                    const nextActiveIndex = index === 0 ? 1 : 0;
                    window.personas[nextActiveIndex].isActive = true;
                    
                    if (typeof window.applyPersonaToAI === 'function') {
                        window.applyPersonaToAI(window.personas[nextActiveIndex]);
                    }
                }
                
                // 删除人设
                window.personas.splice(index, 1);
                
                // 保存
                localStorage.setItem('personas', JSON.stringify(window.personas));
                
                // 重新渲染
                renderPersonaList();
                
                // 显示成功提示
                showNotification('人设已删除', 'success');
            }
        );
    };
    
    // 显示通知
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `mobile-notification ${type}`;
        notification.innerHTML = `
            <span class="notification-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
            <span class="notification-message">${message}</span>
        `;
        
        document.body.appendChild(notification);
        
        // 添加显示动画
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        // 自动隐藏
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);
    }
    
    // 显示确认对话框
    function showConfirmDialog(title, message, onConfirm) {
        const dialog = document.createElement('div');
        dialog.className = 'mobile-confirm-dialog';
        dialog.innerHTML = `
            <div class="dialog-overlay"></div>
            <div class="dialog-content">
                <h3 class="dialog-title">${title}</h3>
                <p class="dialog-message">${message}</p>
                <div class="dialog-actions">
                    <button class="dialog-btn dialog-btn-cancel">取消</button>
                    <button class="dialog-btn dialog-btn-confirm">确定</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        // 添加显示动画
        setTimeout(() => {
            dialog.classList.add('show');
        }, 10);
        
        // 绑定按钮事件
        const cancelBtn = dialog.querySelector('.dialog-btn-cancel');
        const confirmBtn = dialog.querySelector('.dialog-btn-confirm');
        
        const closeDialog = () => {
            dialog.classList.remove('show');
            setTimeout(() => {
                dialog.remove();
            }, 300);
        };
        
        cancelBtn.addEventListener('click', closeDialog);
        confirmBtn.addEventListener('click', () => {
            closeDialog();
            if (onConfirm) onConfirm();
        });
    }
    
    // 添加必要的样式
    function addEnhancedStyles() {
        const styleId = 'persona-enhanced-styles';
        if (document.getElementById(styleId)) return;
        
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            /* 增强的人设卡片样式 */
            .persona-card {
                background: white;
                border: 1px solid #e0e0e0;
                transition: all 0.3s ease;
            }
            
            .persona-card:hover {
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                transform: translateY(-2px);
            }
            
            .persona-card.active {
                border-color: #667eea;
                background: linear-gradient(to bottom, #f0f4ff, white);
            }
            
            /* 美化按钮样式 */
            .persona-actions button {
                position: relative;
                overflow: hidden;
                font-weight: 500;
                transition: all 0.3s ease;
                box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            }
            
            .persona-actions button:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(0,0,0,0.15);
            }
            
            .persona-actions button:active,
            .persona-actions button.touching {
                transform: scale(0.95);
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            
            /* 按钮图标和文字 */
            .btn-icon {
                font-size: 16px;
                margin-right: 4px;
            }
            
            .btn-text {
                font-size: 14px;
            }
            
            /* 激活按钮 */
            .btn-activate {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
            }
            
            /* 编辑按钮 */
            .btn-edit {
                background: linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%);
                color: #2d3748;
            }
            
            /* 删除按钮 */
            .btn-delete {
                background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
                color: white;
            }
            
            /* 激活徽章 */
            .active-badge {
                background: linear-gradient(135deg, #ffeaa7 0%, #fab1a0 100%);
                color: #2d3748;
                font-weight: 600;
                box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            }
            
            .badge-icon {
                font-size: 16px;
                margin-right: 4px;
            }
            
            /* 性别显示 */
            .persona-gender {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 5px;
                font-size: 14px;
                color: #666;
                margin: 5px 0;
            }
            
            /* 背景描述 */
            .persona-background {
                font-size: 13px;
                color: #555;
                line-height: 1.4;
                max-height: 40px;
                overflow: hidden;
                text-overflow: ellipsis;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
            }
            
            /* 绑定角色标签 */
            .bound-characters {
                margin-top: 8px;
                font-size: 12px;
            }
            
            .char-tag {
                display: inline-block;
                padding: 2px 8px;
                margin: 2px;
                background: #e0e7ff;
                color: #4c51bf;
                border-radius: 12px;
                font-size: 11px;
            }
            
            /* 通知样式 */
            .mobile-notification {
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%) translateY(-100px);
                background: white;
                padding: 12px 20px;
                border-radius: 25px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                display: flex;
                align-items: center;
                gap: 8px;
                z-index: 10000;
                transition: transform 0.3s ease;
            }
            
            .mobile-notification.show {
                transform: translateX(-50%) translateY(0);
            }
            
            .mobile-notification.success {
                background: #f0fdf4;
                color: #16a34a;
            }
            
            .mobile-notification.error {
                background: #fef2f2;
                color: #dc2626;
            }
            
            .mobile-notification.info {
                background: #f0f9ff;
                color: #0284c7;
            }
            
            .notification-icon {
                font-size: 18px;
            }
            
            .notification-message {
                font-size: 14px;
                font-weight: 500;
            }
            
            /* 确认对话框 */
            .mobile-confirm-dialog {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                transition: opacity 0.3s ease;
            }
            
            .mobile-confirm-dialog.show {
                opacity: 1;
            }
            
            .dialog-overlay {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.5);
            }
            
            .dialog-content {
                position: relative;
                background: white;
                padding: 20px;
                border-radius: 12px;
                width: 90%;
                max-width: 300px;
                box-shadow: 0 10px 25px rgba(0,0,0,0.2);
                transform: scale(0.9);
                transition: transform 0.3s ease;
            }
            
            .mobile-confirm-dialog.show .dialog-content {
                transform: scale(1);
            }
            
            .dialog-title {
                font-size: 18px;
                font-weight: bold;
                margin-bottom: 10px;
                text-align: center;
            }
            
            .dialog-message {
                font-size: 14px;
                color: #666;
                margin-bottom: 20px;
                text-align: center;
                line-height: 1.5;
            }
            
            .dialog-actions {
                display: flex;
                gap: 10px;
            }
            
            .dialog-btn {
                flex: 1;
                padding: 10px;
                border: none;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.3s ease;
            }
            
            .dialog-btn-cancel {
                background: #f0f0f0;
                color: #666;
            }
            
            .dialog-btn-confirm {
                background: #667eea;
                color: white;
            }
            
            .dialog-btn:active {
                transform: scale(0.95);
            }
            
            /* 移动端表单优化 */
            @media (max-width: 768px) {
                .persona-form-container {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: white;
                    z-index: 1000;
                    overflow-y: auto;
                    -webkit-overflow-scrolling: touch;
                }
                
                .persona-form {
                    padding: 20px;
                }
                
                .form-actions {
                    position: sticky;
                    bottom: 0;
                    background: white;
                    padding: 15px 0;
                    border-top: 1px solid #e0e0e0;
                    margin: 0 -20px;
                    padding-left: 20px;
                    padding-right: 20px;
                }
            }
        `;
        
        document.head.appendChild(style);
    }
    
    // 初始化增强功能
    function initEnhancements() {
        console.log('初始化人设增强功能...');
        
        // 添加增强样式
        addEnhancedStyles();
        
        // 确保全局变量存在
        window.personas = window.personas || [];
        window.currentEditingPersona = null;
        window.currentEditingIndex = null;
        
        // 重新渲染人设列表
        if (document.getElementById('personaList')) {
            renderPersonaList();
        }
        
        // 修复保存人设函数
        const originalSavePersona = window.savePersona;
        window.savePersona = function() {
            console.log('保存人设...');
            
            if (originalSavePersona) {
                originalSavePersona.call(this);
            }
            
            // 确保编辑后正确更新
            if (window.currentEditingIndex !== null) {
                window.currentEditingPersona = null;
                window.currentEditingIndex = null;
            }
        };
        
        console.log('人设增强功能初始化完成');
    }
    
    // 等待模块加载后初始化
    waitForModules(initEnhancements);
    
    // DOM加载完成后再次尝试初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(initEnhancements, 500);
        });
    } else {
        setTimeout(initEnhancements, 500);
    }
})();