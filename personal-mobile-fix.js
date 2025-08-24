// personal-mobile-fix.js - 人设功能移动端修复

(function() {
    'use strict';
    
    console.log('开始加载人设功能移动端修复...');
    
    // 等待必要的模块加载
    function waitForModules(callback) {
        let attempts = 0;
        const maxAttempts = 50;
        
        const checkModules = setInterval(() => {
            attempts++;
            
            if (window.personas !== undefined && 
                window.ResponsiveAdapter && 
                typeof window.renderPersonaList === 'function') {
                clearInterval(checkModules);
                callback();
            } else if (attempts >= maxAttempts) {
                clearInterval(checkModules);
                console.error('等待模块加载超时');
            }
        }, 100);
    }
    
    // 修复渲染人设列表函数
    window.renderPersonaList = function() {
        const list = document.getElementById('personaList');
        if (!list) return;
        
        if (!window.personas || window.personas.length === 0) {
            list.innerHTML = '<p style="text-align: center; color: #999;">暂无人设，点击上方按钮创建</p>';
            return;
        }
        
        list.innerHTML = window.personas.map((persona, index) => `
            <div class="persona-card ${persona.isActive ? 'active' : ''}" data-index="${index}">
                <div class="persona-avatar">
                    <img src="${persona.avatar || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Ccircle cx="50" cy="50" r="50" fill="%23ddd"/%3E%3C/svg%3E'}" alt="${persona.name}">
                </div>
                <div class="persona-info">
                    <h4>${persona.name}</h4>
                    <p>${persona.gender === 'male' ? '男' : persona.gender === 'female' ? '女' : '其他'}</p>
                    <p class="persona-background">${persona.background || '暂无背景描述'}</p>
                    ${persona.boundCharacters && persona.boundCharacters.length > 0 ? 
                        `<div class="bound-characters">
                            <span>绑定角色：</span>
                            ${persona.boundCharacters.map(char => `<span class="char-tag">${char.name}</span>`).join('')}
                        </div>` : ''}
                </div>
                <div class="persona-actions">
                    ${!persona.isActive ? 
                        `<button class="btn-activate" data-action="activate" data-index="${index}">激活</button>` :
                        `<span class="active-badge">当前使用</span>`}
                    <button class="btn-edit" data-action="edit" data-index="${index}">编辑</button>
                    <button class="btn-delete" data-action="delete" data-index="${index}">删除</button>
                </div>
            </div>
        `).join('');
        
        // 绑定事件处理器
        bindPersonaEvents();
    };
    
    // 绑定人设事件
    function bindPersonaEvents() {
        const personaList = document.getElementById('personaList');
        if (!personaList) return;
        
        // 使用事件委托处理所有按钮点击
        personaList.addEventListener('click', handlePersonaAction);
        
        // 添加触摸事件支持
        if (window.ResponsiveAdapter && window.ResponsiveAdapter.device.isTouch) {
            personaList.addEventListener('touchend', function(e) {
                const button = e.target.closest('button[data-action]');
                if (button) {
                    e.preventDefault();
                    e.stopPropagation();
                    handlePersonaAction({ target: button });
                }
            });
        }
    }
    
    // 处理人设操作
    function handlePersonaAction(e) {
        const button = e.target.closest('button[data-action]');
        if (!button) return;
        
        const action = button.getAttribute('data-action');
        const index = parseInt(button.getAttribute('data-index'));
        
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
        }
    }
    
    // 修复激活人设
    window.activatePersona = function(index) {
        if (!window.personas || !window.personas[index]) return;
        
        // 取消其他人设的激活状态
        window.personas.forEach(p => p.isActive = false);
        
        // 激活选中的人设
        window.personas[index].isActive = true;
        
        // 保存到本地存储
        if (typeof window.savePersonas === 'function') {
            window.savePersonas();
        } else {
            localStorage.setItem('personas', JSON.stringify(window.personas));
        }
        
        // 重新渲染列表
        renderPersonaList();
        
        // 应用到AI系统
        if (typeof window.applyPersonaToAI === 'function') {
            window.applyPersonaToAI(window.personas[index]);
        }
        
        alert(`已切换到人设：${window.personas[index].name}`);
    };
    
    // 修复编辑人设
    window.editPersona = function(index) {
        const persona = window.personas[index];
        if (!persona) return;
        
        window.currentEditingPersona = persona;
        
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
        
        // 显示表单
        const listSection = document.getElementById('persona-list');
        const formSection = document.getElementById('persona-form');
        if (listSection) listSection.style.display = 'none';
        if (formSection) formSection.style.display = 'block';
        
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
    
    // 修复删除人设
    window.deletePersona = function(index) {
        if (!window.personas || !window.personas[index]) return;
        
        const persona = window.personas[index];
        
        // 使用原生确认框，移动端兼容性更好
        const confirmed = confirm(`确定要删除人设"${persona.name}"吗？`);
        if (!confirmed) return;
        
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
        if (typeof window.savePersonas === 'function') {
            window.savePersonas();
        } else {
            localStorage.setItem('personas', JSON.stringify(window.personas));
        }
        
        // 重新渲染
        renderPersonaList();
        
        alert('人设已删除');
    };
    
    // 修复角色绑定选择
    window.loadCharactersForBinding = function() {
        const grid = document.getElementById('characterBindGrid');
        const contacts = JSON.parse(localStorage.getItem('chatContacts') || '[]');
        
        if (!grid) return;
        
        if (contacts.length === 0) {
            grid.innerHTML = '<p style="color: #999;">暂无可绑定的角色</p>';
            return;
        }
        
        grid.innerHTML = contacts.map(contact => `
            <label class="character-bind-item" data-id="${contact.id}">
                <input type="checkbox" value="${contact.id}" data-name="${contact.name}">
                <img src="${contact.avatar}" alt="${contact.name}">
                <span>${contact.name}</span>
            </label>
        `).join('');
        
        // 为移动端优化复选框交互
        if (window.ResponsiveAdapter && window.ResponsiveAdapter.device.isTouch) {
            grid.addEventListener('click', function(e) {
                const label = e.target.closest('.character-bind-item');
                if (label && !e.target.matches('input[type="checkbox"]')) {
                    e.preventDefault();
                    const checkbox = label.querySelector('input[type="checkbox"]');
                    if (checkbox) {
                        checkbox.checked = !checkbox.checked;
                        const event = new Event('change', { bubbles: true });
                        checkbox.dispatchEvent(event);
                    }
                }
            });
        }
    };
    
    // 修复保存人设函数
    window.savePersona = function() {
        const name = document.getElementById('personaName').value.trim();
        const gender = document.querySelector('input[name="personaGender"]:checked')?.value || 'other';
        const background = document.getElementById('personaBackground').value.trim();
        const avatarImg = document.getElementById('personaAvatarImg');
        const avatar = avatarImg && avatarImg.style.display !== 'none' ? avatarImg.src : null;
        
        if (!name) {
            alert('请输入人设名称');
            return;
        }
        
        // 获取选中的角色
        const selectedCharacters = [];
        document.querySelectorAll('.character-bind-item input[type="checkbox"]:checked').forEach(cb => {
            selectedCharacters.push({
                id: cb.value,
                name: cb.getAttribute('data-name')
            });
        });
        
        const personaData = {
            id: window.currentEditingPersona ? window.currentEditingPersona.id : 'persona_' + Date.now(),
            name,
            gender,
            background,
            avatar,
            boundCharacters: selectedCharacters,
            isActive: false,
            createdAt: window.currentEditingPersona ? window.currentEditingPersona.createdAt : new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        if (window.currentEditingPersona) {
            // 编辑模式
            const index = window.personas.findIndex(p => p.id === window.currentEditingPersona.id);
            if (index !== -1) {
                personaData.isActive = window.personas[index].isActive;
                window.personas[index] = personaData;
            }
        } else {
            // 新建模式
            if (window.personas.length === 0) {
                personaData.isActive = true;
            }
            window.personas.push(personaData);
        }
        
        // 保存
        if (typeof window.savePersonas === 'function') {
            window.savePersonas();
        } else {
            localStorage.setItem('personas', JSON.stringify(window.personas));
        }
        
        // 如果是激活的人设，应用到AI系统
        if (personaData.isActive && typeof window.applyPersonaToAI === 'function') {
            window.applyPersonaToAI(personaData);
        }
        
        // 返回列表
        if (typeof window.cancelPersonaForm === 'function') {
            window.cancelPersonaForm();
        } else {
            document.getElementById('persona-form').style.display = 'none';
            document.getElementById('persona-list').style.display = 'block';
            renderPersonaList();
        }
        
        alert(window.currentEditingPersona ? '人设已更新' : '人设已创建');
    };
    
    // 初始化修复
    function initFixes() {
        console.log('初始化人设移动端修复...');
        
        // 确保全局变量存在
        window.personas = window.personas || [];
        window.currentEditingPersona = null;
        
        // 重新渲染人设列表以应用修复
        if (document.getElementById('personaList')) {
            renderPersonaList();
        }
        
        // 修复头像上传
        const avatarUpload = document.getElementById('personaAvatar');
        if (avatarUpload) {
            avatarUpload.removeEventListener('change', window.handleAvatarUpload);
            avatarUpload.addEventListener('change', function(e) {
                const file = e.target.files[0];
                if (!file) return;
                
                const reader = new FileReader();
                reader.onload = function(event) {
                    const avatarImg = document.getElementById('personaAvatarImg');
                    const avatarPlaceholder = document.getElementById('personaAvatarPlaceholder');
                    
                    if (avatarImg) {
                        avatarImg.src = event.target.result;
                        avatarImg.style.display = 'block';
                    }
                    if (avatarPlaceholder) {
                        avatarPlaceholder.style.display = 'none';
                    }
                };
                reader.readAsDataURL(file);
            });
        }
        
        console.log('人设移动端修复完成');
    }
    
    // 等待模块加载后初始化
    waitForModules(initFixes);
    
    // DOM加载完成后再次尝试初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initFixes);
    } else {
        setTimeout(initFixes, 500);
    }
})();