// personal.js - 个人模块核心功能（修复版）

// ==================== 全局变量 ====================
let personas = [];
let transactions = [];
let calendarEvents = {};
let accountBalance = 10000;
let currentEditingPersona = null;
let currentEditingDate = null;
let currentMonth = new Date();
let currentCalendarMonth = new Date();

// ==================== 人设管理功能 ====================

// 初始化个人模块
function initPersonalModule() {
    console.log('初始化个人模块...');
    loadPersonas();
    loadTransactions();
    loadCalendarEvents();
    
    // 设置默认显示人设页面
    showPersonalSection('persona');
    
    // 初始化文件上传事件
    const personaAvatar = document.getElementById('personaAvatar');
    if (personaAvatar) {
        personaAvatar.addEventListener('change', handleAvatarUpload);
    }
    
    // 初始化日历提醒检查
    setInterval(checkCalendarReminders, 60000); // 每分钟检查一次
}

// 加载人设列表
function loadPersonas() {
    const saved = localStorage.getItem('personas');
    if (saved) {
        personas = JSON.parse(saved);
    }
    renderPersonaList();
}

// 渲染人设列表
function renderPersonaList() {
    const list = document.getElementById('personaList');
    if (!list) return;
    
    if (personas.length === 0) {
        list.innerHTML = '<p style="text-align: center; color: #999;">暂无人设，点击上方按钮创建</p>';
        return;
    }
    
    list.innerHTML = personas.map((persona, index) => `
        <div class="persona-card ${persona.isActive ? 'active' : ''}">
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
                    `<button class="btn-activate" onclick="activatePersona(${index})">激活</button>` :
                    `<span class="active-badge">当前使用</span>`}
                <button class="btn-edit" onclick="editPersona(${index})">编辑</button>
                <button class="btn-delete" onclick="deletePersona(${index})">删除</button>
            </div>
        </div>
    `).join('');
}

// 显示创建人设表单
function showCreatePersona() {
    currentEditingPersona = null;
    document.getElementById('personaFormTitle').textContent = '新建人设';
    document.getElementById('personaName').value = '';
    document.getElementById('personaBackground').value = '';
    document.getElementById('personaAvatarImg').style.display = 'none';
    document.getElementById('personaAvatarPlaceholder').style.display = 'block';
    document.querySelector('input[name="personaGender"][value="male"]').checked = true;
    
    // 清空已选择的角色
    document.querySelectorAll('.character-bind-item input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
    });
    
    document.getElementById('personaList').style.display = 'none';
    document.getElementById('persona-form').style.display = 'block';
    
    loadCharactersForBinding();
}

// 加载可绑定的角色列表
function loadCharactersForBinding() {
    const grid = document.getElementById('characterBindGrid');
    const contacts = JSON.parse(localStorage.getItem('chatContacts') || '[]');
    
    if (contacts.length === 0) {
        grid.innerHTML = '<p style="color: #999;">暂无可绑定的角色</p>';
        return;
    }
    
    grid.innerHTML = contacts.map(contact => `
        <label class="character-bind-item">
            <input type="checkbox" value="${contact.id}" data-name="${contact.name}">
            <img src="${contact.avatar}" alt="${contact.name}">
            <span>${contact.name}</span>
        </label>
    `).join('');
}

// 处理头像上传
function handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById('personaAvatarImg').src = e.target.result;
        document.getElementById('personaAvatarImg').style.display = 'block';
        document.getElementById('personaAvatarPlaceholder').style.display = 'none';
    };
    reader.readAsDataURL(file);
}

// 保存人设
function savePersona() {
    const name = document.getElementById('personaName').value.trim();
    const gender = document.querySelector('input[name="personaGender"]:checked')?.value || 'other';
    const background = document.getElementById('personaBackground').value.trim();
    const avatarImg = document.getElementById('personaAvatarImg');
    const avatar = avatarImg.style.display !== 'none' ? avatarImg.src : null;
    
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
        id: currentEditingPersona ? currentEditingPersona.id : 'persona_' + Date.now(),
        name,
        gender,
        background,
        avatar,
        boundCharacters: selectedCharacters,
        isActive: false,
        createdAt: currentEditingPersona ? currentEditingPersona.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    if (currentEditingPersona) {
        // 编辑模式
        const index = personas.findIndex(p => p.id === currentEditingPersona.id);
        if (index !== -1) {
            personaData.isActive = personas[index].isActive;
            personas[index] = personaData;
        }
    } else {
        // 新建模式
        // 如果是第一个人设，自动激活
        if (personas.length === 0) {
            personaData.isActive = true;
        }
        personas.push(personaData);
    }
    
    savePersonas();
    cancelPersonaForm();
    
    // 如果是激活的人设，应用到AI系统
    if (personaData.isActive) {
        applyPersonaToAI(personaData);
    }
}

// 保存人设到本地存储
function savePersonas() {
    localStorage.setItem('personas', JSON.stringify(personas));
}

// 取消人设表单
function cancelPersonaForm() {
    document.getElementById('persona-form').style.display = 'none';
    document.getElementById('personaList').style.display = 'grid';
    renderPersonaList();
}

// 编辑人设
function editPersona(index) {
    const persona = personas[index];
    if (!persona) return;
    
    currentEditingPersona = persona;
    document.getElementById('personaFormTitle').textContent = '编辑人设';
    document.getElementById('personaName').value = persona.name;
    document.getElementById('personaBackground').value = persona.background || '';
    
    // 设置头像
    if (persona.avatar) {
        document.getElementById('personaAvatarImg').src = persona.avatar;
        document.getElementById('personaAvatarImg').style.display = 'block';
        document.getElementById('personaAvatarPlaceholder').style.display = 'none';
    } else {
        document.getElementById('personaAvatarImg').style.display = 'none';
        document.getElementById('personaAvatarPlaceholder').style.display = 'block';
    }
    
    // 设置性别
    document.querySelector(`input[name="personaGender"][value="${persona.gender}"]`).checked = true;
    
    // 设置绑定的角色
    loadCharactersForBinding();
    setTimeout(() => {
        if (persona.boundCharacters) {
            persona.boundCharacters.forEach(char => {
                const checkbox = document.querySelector(`.character-bind-item input[value="${char.id}"]`);
                if (checkbox) checkbox.checked = true;
            });
        }
    }, 100);
    
    document.getElementById('personaList').style.display = 'none';
    document.getElementById('persona-form').style.display = 'block';
}

// 删除人设
function deletePersona(index) {
    if (!confirm('确定要删除这个人设吗？')) return;
    
    const persona = personas[index];
    if (persona.isActive && personas.length > 1) {
        // 如果删除的是激活的人设，激活第一个其他人设
        const nextIndex = index === 0 ? 1 : 0;
        personas[nextIndex].isActive = true;
        applyPersonaToAI(personas[nextIndex]);
    }
    
    personas.splice(index, 1);
    savePersonas();
    renderPersonaList();
}

// 激活人设
function activatePersona(index) {
    // 取消其他人设的激活状态
    personas.forEach(p => p.isActive = false);
    
    // 激活选中的人设
    personas[index].isActive = true;
    savePersonas();
    renderPersonaList();
    
    // 应用到AI系统
    applyPersonaToAI(personas[index]);
    
    alert(`已切换到人设：${personas[index].name}`);
}

// ==================== 账户管理功能 ====================

// 加载交易记录
function loadTransactions() {
    const saved = localStorage.getItem('transactions');
    if (saved) {
        transactions = JSON.parse(saved);
    }
    
    const savedBalance = localStorage.getItem('accountBalance');
    if (savedBalance) {
        accountBalance = parseFloat(savedBalance);
    }
    
    updateAccountDisplay();
}

// 更新账户显示
function updateAccountDisplay() {
    const balanceElement = document.getElementById('accountBalance');
    if (balanceElement) {
        balanceElement.textContent = `¥${accountBalance.toFixed(2)}`;
    }
    
    updateMonthlyStats();
    renderTransactionList();
}

// 更新月度统计
function updateMonthlyStats() {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    let monthlyIncome = 0;
    let monthlyExpense = 0;
    
    transactions.forEach(trans => {
        const transDate = new Date(trans.date);
        if (transDate.getFullYear() === year && transDate.getMonth() === month) {
            if (trans.amount > 0) {
                monthlyIncome += trans.amount;
            } else {
                monthlyExpense += Math.abs(trans.amount);
            }
        }
    });
    
    const incomeElement = document.getElementById('monthlyIncome');
    const expenseElement = document.getElementById('monthlyExpense');
    
    if (incomeElement) incomeElement.textContent = `¥${monthlyIncome.toFixed(2)}`;
    if (expenseElement) expenseElement.textContent = `¥${monthlyExpense.toFixed(2)}`;
}

// 切换交易视图
function switchTransactionView(view) {
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    if (event && event.target) {
        event.target.classList.add('active');
    }
    
    // 这里可以根据view类型切换显示逻辑
    renderTransactionList(view);
}

// 切换月份
function changeMonth(direction) {
    currentMonth.setMonth(currentMonth.getMonth() + direction);
    
    const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    const monthElement = document.getElementById('currentMonth');
    if (monthElement) {
        monthElement.textContent = `${currentMonth.getFullYear()}年${monthNames[currentMonth.getMonth()]}`;
    }
    
    updateMonthlyStats();
    renderTransactionList();
}

// 渲染交易列表
function renderTransactionList(view = 'daily') {
    const list = document.getElementById('transactionList');
    if (!list) return;
    
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    // 筛选当前月份的交易
    const monthTransactions = transactions.filter(trans => {
        const transDate = new Date(trans.date);
        return transDate.getFullYear() === year && transDate.getMonth() === month;
    });
    
    if (monthTransactions.length === 0) {
        list.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">本月暂无交易记录</p>';
        return;
    }
    
    // 按日期分组
    const grouped = {};
    monthTransactions.forEach(trans => {
        const date = trans.date.split('T')[0];
        if (!grouped[date]) {
            grouped[date] = [];
        }
        grouped[date].push(trans);
    });
    
    // 渲染列表
    list.innerHTML = Object.keys(grouped)
        .sort((a, b) => new Date(b) - new Date(a))
        .map(date => {
            const dayTransactions = grouped[date];
            const dayTotal = dayTransactions.reduce((sum, trans) => sum + trans.amount, 0);
            
            return `
                <div class="transaction-group">
                    <div class="transaction-date">
                        <span>${formatTransactionDate(date)}</span>
                        <span class="${dayTotal >= 0 ? 'income' : 'expense'}">
                            ${dayTotal >= 0 ? '+' : ''}¥${Math.abs(dayTotal).toFixed(2)}
                        </span>
                    </div>
                    ${dayTransactions.map(trans => `
                        <div class="transaction-item">
                            <div class="transaction-info">
                                <div class="transaction-title">${trans.title}</div>
                                <div class="transaction-desc">${trans.description || ''}</div>
                            </div>
                            <div class="transaction-amount ${trans.amount >= 0 ? 'income' : 'expense'}">
                                ${trans.amount >= 0 ? '+' : ''}¥${Math.abs(trans.amount).toFixed(2)}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }).join('');
}

// 格式化交易日期
function formatTransactionDate(dateStr) {
    const date = new Date(dateStr);
    const today = new Date();
    
    if (date.toDateString() === today.toDateString()) {
        return '今天';
    }
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
        return '昨天';
    }
    
    return `${date.getMonth() + 1}月${date.getDate()}日`;
}

// 添加交易记录
function addTransaction(title, amount, description = '', source = 'user') {
    const transaction = {
        id: 'trans_' + Date.now(),
        title,
        amount,
        description,
        source,
        date: new Date().toISOString(),
        createdAt: new Date().toISOString()
    };
    
    transactions.push(transaction);
    accountBalance += amount;
    
    saveTransactions();
    updateAccountDisplay();
    
    return transaction;
}

// 保存交易记录
function saveTransactions() {
    localStorage.setItem('transactions', JSON.stringify(transactions));
    localStorage.setItem('accountBalance', accountBalance.toString());
}

// ==================== 日历功能 ====================

// 加载日历事件
function loadCalendarEvents() {
    const saved = localStorage.getItem('calendarEvents');
    if (saved) {
        calendarEvents = JSON.parse(saved);
    }
    renderCalendar();
}

// 保存日历事件
function saveCalendarEvents() {
    localStorage.setItem('calendarEvents', JSON.stringify(calendarEvents));
}

// 切换日历月份
function changeCalendarMonth(direction) {
    currentCalendarMonth.setMonth(currentCalendarMonth.getMonth() + direction);
    
    const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    const monthElement = document.getElementById('calendarMonth');
    if (monthElement) {
        monthElement.textContent = `${currentCalendarMonth.getFullYear()}年${monthNames[currentCalendarMonth.getMonth()]}`;
    }
    
    renderCalendar();
}

// 渲染日历
function renderCalendar() {
    const container = document.getElementById('calendarDays');
    if (!container) return;
    
    const year = currentCalendarMonth.getFullYear();
    const month = currentCalendarMonth.getMonth();
    
    // 获取月份第一天
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const prevLastDay = new Date(year, month, 0);
    
    const firstDayWeek = firstDay.getDay();
    const totalDays = lastDay.getDate();
    const prevTotalDays = prevLastDay.getDate();
    
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    let html = '';
    
    // 上月的日期
    for (let i = firstDayWeek - 1; i >= 0; i--) {
        const day = prevTotalDays - i;
        html += `<div class="calendar-day other-month">${day}</div>`;
    }
    
    // 本月的日期
    for (let day = 1; day <= totalDays; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isToday = dateStr === todayStr;
        const events = calendarEvents[dateStr] || [];
        
        html += `
            <div class="calendar-day ${isToday ? 'today' : ''} ${events.length > 0 ? 'has-event' : ''}" 
                 onclick="showDateEvent('${dateStr}')">
                <div class="day-number">${day}</div>
                ${events.length > 0 ? `
                    <div class="day-events">
                        ${events.slice(0, 2).map(event => `
                            <div class="event-dot ${event.type || 'normal'}" title="${event.content}"></div>
                        `).join('')}
                        ${events.length > 2 ? `<span class="more-events">+${events.length - 2}</span>` : ''}
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    // 下月的日期
    const remainingDays = 42 - (firstDayWeek + totalDays);
    for (let day = 1; day <= remainingDays; day++) {
        html += `<div class="calendar-day other-month">${day}</div>`;
    }
    
    container.innerHTML = html;
}

// 获取AI角色信息
function getAICharacterInfo(characterId) {
    const contacts = JSON.parse(localStorage.getItem('chatContacts') || '[]');
    return contacts.find(c => c.id === characterId);
}

// 显示日期事件编辑
function showDateEvent(dateStr) {
    currentEditingDate = dateStr;
    const modal = document.getElementById('dateEventModal');
    if (!modal) {
        console.log('日期事件弹窗功能尚未实现');
        return;
    }
    
    const events = calendarEvents[dateStr] || [];
    
    // 检查是否已有用户事件
    const userEvent = events.find(e => e.author === 'user');
    
    if (userEvent) {
        // 编辑模式
        document.getElementById('dateEventTitle').textContent = '编辑事件';
        document.getElementById('eventType').value = userEvent.type;
        document.getElementById('eventContent').value = userEvent.content;
        document.getElementById('eventReminderTime').value = userEvent.reminderTime || '';
        
        if (userEvent.type === 'anniversary') {
            document.getElementById('anniversaryOptions').style.display = 'block';
            document.getElementById('anniversaryStartDate').value = userEvent.startDate || '';
        }
    } else {
        // 新建模式
        document.getElementById('dateEventTitle').textContent = '添加事件';
        document.getElementById('eventType').value = 'normal';
        document.getElementById('eventContent').value = '';
        document.getElementById('eventReminderTime').value = '';
        document.getElementById('anniversaryOptions').style.display = 'none';
    }
    
    modal.style.display = 'flex';
}

// 处理事件类型改变
function handleEventTypeChange() {
    const type = document.getElementById('eventType').value;
    const anniversaryOptions = document.getElementById('anniversaryOptions');
    if (anniversaryOptions) {
        if (type === 'anniversary') {
            anniversaryOptions.style.display = 'block';
        } else {
            anniversaryOptions.style.display = 'none';
        }
    }
}

// 保存日期事件
function saveDateEvent() {
    const type = document.getElementById('eventType').value;
    const content = document.getElementById('eventContent').value.trim();
    const reminderTime = document.getElementById('eventReminderTime').value;
    
    if (!content) {
        alert('请输入事件内容');
        return;
    }
    
    const event = {
        id: 'event_' + Date.now(),
        type: type,
        content: content,
        reminderTime: reminderTime,
        author: 'user',
        createdAt: new Date().toISOString()
    };
    
    if (type === 'anniversary') {
        const startDate = document.getElementById('anniversaryStartDate').value;
        if (!startDate) {
            alert('请选择纪念日开始日期');
            return;
        }
        event.startDate = startDate;
    }
    
    // 获取当前日期的事件列表
    if (!calendarEvents[currentEditingDate]) {
        calendarEvents[currentEditingDate] = [];
    }
    
    // 移除已有的用户事件
    calendarEvents[currentEditingDate] = calendarEvents[currentEditingDate].filter(e => e.author !== 'user');
    
    // 添加新事件
    calendarEvents[currentEditingDate].push(event);
    
    saveCalendarEvents();
    
    // 通知所有绑定的AI角色
    notifyAIAboutCalendarEvent(event, currentEditingDate);
    
    // 关闭弹窗并刷新
    closeDateEventModal();
    renderCalendar();
    renderEventList();
    
    alert('事件保存成功！');
}

// 关闭日期事件弹窗
function closeDateEventModal() {
    const modal = document.getElementById('dateEventModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// 切换事件标签
function switchEventTab(tab) {
    // 更新标签状态
    document.querySelectorAll('.event-tab').forEach(t => {
        t.classList.remove('active');
    });
    
    if (event && event.target) {
        event.target.classList.add('active');
    }
    
    renderEventList(tab);
}

// 渲染事件列表
function renderEventList(filter = 'all') {
    const list = document.getElementById('eventList');
    if (!list) return;
    
    const allEvents = [];
    
    // 收集所有事件
    Object.keys(calendarEvents).forEach(date => {
        calendarEvents[date].forEach(event => {
            allEvents.push({...event, date: date});
        });
    });
    
    // 添加纪念日事件到今天
    const today = new Date().toISOString().split('T')[0];
    Object.keys(calendarEvents).forEach(date => {
        calendarEvents[date].forEach(event => {
            if (event.type === 'anniversary' && event.startDate) {
                const startDate = new Date(event.startDate);
                const todayDate = new Date(today);
                if (startDate.getMonth() === todayDate.getMonth() && 
                    startDate.getDate() === todayDate.getDate() &&
                    startDate.getFullYear() < todayDate.getFullYear()) {
                    const years = todayDate.getFullYear() - startDate.getFullYear();
                    allEvents.push({
                        ...event,
                        date: today,
                        content: `${event.content} (${years}周年)`,
                        isAnniversaryReminder: true
                    });
                }
            }
        });
    });
    
    // 过滤事件
    let filteredEvents = allEvents;
    if (filter === 'mine') {
        filteredEvents = allEvents.filter(e => e.author === 'user');
    } else if (filter === 'ai') {
        filteredEvents = allEvents.filter(e => e.author !== 'user');
    }
    
    // 按日期倒序排列
    filteredEvents.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    if (filteredEvents.length === 0) {
        list.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">暂无事件记录</p>';
        return;
    }
    
    list.innerHTML = filteredEvents.map(event => {
        const typeClass = event.type ? `event-type-badge ${event.type}` : '';
        const typeText = getEventTypeText(event.type);
        
        return `
            <div class="event-item" onclick="${event.author !== 'user' ? `viewAIEvent('${event.date}', '${event.id}')` : ''}">
                <div class="event-date">${formatEventDate(event.date)}</div>
                <div class="event-content">
                    ${event.content}
                    ${typeText ? `<span class="${typeClass}">${typeText}</span>` : ''}
                    ${event.isAnniversaryReminder ? '<span class="event-type-badge anniversary">今日纪念</span>' : ''}
                </div>
                <div class="event-author">
                    ${event.author === 'user' ? '我' : event.authorName || 'AI'}
                </div>
            </div>
        `;
    }).join('');
}

// 获取事件类型文本
function getEventTypeText(type) {
    const typeMap = {
        'birthday': '生日',
        'anniversary': '纪念日',
        'holiday': '节日',
        'reminder': '提醒',
        'normal': ''
    };
    return typeMap[type] || '';
}

// 格式化事件日期
function formatEventDate(dateStr) {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
        return '今天';
    } else if (date.toDateString() === yesterday.toDateString()) {
        return '昨天';
    } else {
        return date.toLocaleDateString('zh-CN');
    }
}

// 查看AI事件
function viewAIEvent(date, eventId) {
    const events = calendarEvents[date] || [];
    const event = events.find(e => e.id === eventId);
    
    if (!event) return;
    
    // 获取AI角色信息
    const contacts = JSON.parse(localStorage.getItem('chatContacts') || '[]');
    const author = contacts.find(c => c.id === event.authorId);
    
    const avatarElement = document.getElementById('aiEventAvatar');
    const authorElement = document.getElementById('aiEventAuthor');
    const contentElement = document.getElementById('aiEventContent');
    const timeElement = document.getElementById('aiEventTime');
    
    if (avatarElement) avatarElement.src = author?.avatar || '';
    if (authorElement) authorElement.textContent = event.authorName || 'AI';
    if (contentElement) contentElement.textContent = event.content;
    if (timeElement) timeElement.textContent = `记录时间：${new Date(event.createdAt).toLocaleString('zh-CN')}`;
    
    const modal = document.getElementById('aiEventModal');
    if (modal) modal.style.display = 'flex';
}

// 关闭AI事件弹窗
function closeAIEventModal() {
    const modal = document.getElementById('aiEventModal');
    if (modal) modal.style.display = 'none';
}

// 检查日历提醒
function checkCalendarReminders() {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const today = now.toISOString().split('T')[0];
    
    const events = calendarEvents[today] || [];
    events.forEach(event => {
        if (event.reminderTime === currentTime && !event.reminded) {
            // 标记已提醒
            event.reminded = true;
            saveCalendarEvents();
            
            // 显示提醒
            showCalendarNotification(
                event.author === 'user' ? '您的提醒' : event.authorName || 'AI提醒',
                event.content
            );
            
            // 通知AI系统
            if (event.author === 'user') {
                notifyAIAboutReminder(event);
            }
        }
    });
}

// ==================== AI系统集成功能 ====================

// 应用人设到AI系统
function applyPersonaToAI(persona) {
    if (!persona) return;
    
    // 将人设信息保存到全局
    localStorage.setItem('currentUserPersona', JSON.stringify(persona));
    
    // 通知所有绑定的AI角色
    if (persona.boundCharacters) {
        persona.boundCharacters.forEach(char => {
            // 更新AI角色的用户认知
            updateAICharacterKnowledge(char.id, {
                userPersona: {
                    name: persona.name,
                    gender: persona.gender,
                    background: persona.background,
                    avatar: persona.avatar
                },
                updateType: 'persona_change'
            });
        });
    }
}

// 更新AI角色的知识
function updateAICharacterKnowledge(characterId, data) {
    // 获取角色的知识库
    const knowledgeKey = `ai_knowledge_${characterId}`;
    let knowledge = JSON.parse(localStorage.getItem(knowledgeKey) || '{}');
    
    // 更新知识
    if (data.userPersona) {
        knowledge.userPersona = data.userPersona;
    }
    
    if (data.calendarEvent) {
        if (!knowledge.calendarEvents) {
            knowledge.calendarEvents = [];
        }
        knowledge.calendarEvents.push(data.calendarEvent);
        // 只保留最近100条事件
        if (knowledge.calendarEvents.length > 100) {
            knowledge.calendarEvents = knowledge.calendarEvents.slice(-100);
        }
    }
    
    if (data.reminder) {
        if (!knowledge.reminders) {
            knowledge.reminders = [];
        }
        knowledge.reminders.push(data.reminder);
    }
    
    // 保存更新后的知识
    localStorage.setItem(knowledgeKey, JSON.stringify(knowledge));
    
    // 如果AI管理器存在，同步更新
    if (window.AIManager && window.AIManager.roleManager) {
        window.AIManager.roleManager.updateRoleMemory(characterId, knowledge);
    }
}

// 通知AI关于日历事件
function notifyAIAboutCalendarEvent(event, date) {
    // 获取当前激活的人设
    const activePersona = personas.find(p => p.isActive);
    if (!activePersona || !activePersona.boundCharacters) return;
    
    // 通知所有绑定的角色
    activePersona.boundCharacters.forEach(char => {
        updateAICharacterKnowledge(char.id, {
            calendarEvent: {
                date: date,
                content: event.content,
                type: event.type,
                reminderTime: event.reminderTime,
                addedAt: new Date().toISOString()
            }
        });
    });
}

// 通知AI关于提醒
function notifyAIAboutReminder(event) {
    const activePersona = personas.find(p => p.isActive);
    if (!activePersona || !activePersona.boundCharacters) return;
    
    activePersona.boundCharacters.forEach(char => {
        updateAICharacterKnowledge(char.id, {
            reminder: {
                content: event.content,
                triggeredAt: new Date().toISOString()
            }
        });
    });
}

// AI添加日历事件
function addAICalendarEvent(authorId, authorName, content, type = 'normal') {
    const today = new Date().toISOString().split('T')[0];
    
    const event = {
        id: 'ai_event_' + Date.now(),
        type: type,
        content: content,
        author: 'ai',
        authorId: authorId,
        authorName: authorName,
        createdAt: new Date().toISOString()
    };
    
    if (!calendarEvents[today]) {
        calendarEvents[today] = [];
    }
    
    calendarEvents[today].push(event);
    saveCalendarEvents();
    
    // 显示通知
    showCalendarNotification(authorName, content);
    
    // 刷新日历显示
    if (document.getElementById('calendar-section') && 
        document.getElementById('calendar-section').style.display !== 'none') {
        renderCalendar();
        renderEventList();
    }
}

// 显示日历通知
function showCalendarNotification(authorName, content) {
    const notification = document.getElementById('calendarNotification');
    if (!notification) return;
    
    const titleElement = document.getElementById('notificationTitle');
    const messageElement = document.getElementById('notificationMessage');
    
    if (titleElement) titleElement.textContent = `${authorName} 添加了日历记录`;
    if (messageElement) messageElement.textContent = content;
    notification.style.display = 'block';
    
    // 5秒后自动关闭
    setTimeout(() => {
        closeCalendarNotification();
    }, 5000);
}

// 查看日历通知
function viewCalendarNotification() {
    closeCalendarNotification();
    showSection('settings');
    setTimeout(() => {
        showSettingsTab('personal');
        showPersonalSection('calendar');
    }, 100);
}

// 关闭日历通知
function closeCalendarNotification() {
    const notification = document.getElementById('calendarNotification');
    if (notification) {
        notification.style.display = 'none';
    }
}

// 显示个人部分
function showPersonalSection(section) {
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
            renderPersonaList();
            break;
        case 'account':
            updateAccountDisplay();
            break;
        case 'calendar':
            renderCalendar();
            renderEventList();
            // 添加事件类型改变监听
            const eventTypeSelect = document.getElementById('eventType');
            if (eventTypeSelect && !eventTypeSelect.hasAttribute('data-listener-added')) {
                eventTypeSelect.addEventListener('change', handleEventTypeChange);
                eventTypeSelect.setAttribute('data-listener-added', 'true');
            }
            break;
    }
}

// ==================== 导出供全局使用 ====================

window.PersonalModule = {
    init: initPersonalModule,
    addTransaction: addTransaction,
    addAICalendarEvent: addAICalendarEvent,
    getActivePersona: () => personas.find(p => p.isActive),
    getAccountBalance: () => accountBalance,
    getCalendarEvents: () => calendarEvents,
    checkCalendarReminders: checkCalendarReminders,
    updateAICharacterKnowledge: updateAICharacterKnowledge,
    currentSection: 'persona'
};

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', function() {
    // 当点击设置中的个人标签时初始化
    const personalTab = document.querySelector('[onclick*="showSettingsTab(\'personal\')"]');
    if (personalTab) {
        const originalClick = personalTab.onclick;
        personalTab.onclick = function() {
            if (originalClick) originalClick.call(this);
            initPersonalModule();
        };
    }
});

// 导出初始化函数
window.initPersonalModule = initPersonalModule;
window.initPersonaModule = initPersonalModule; // 兼容别名
window.showPersonalSection = showPersonalSection;
window.showCreatePersona = showCreatePersona;
window.editPersona = editPersona;
window.deletePersona = deletePersona;
window.activatePersona = activatePersona;
window.savePersona = savePersona;
window.cancelPersonaForm = cancelPersonaForm;
window.loadCharactersForBinding = loadCharactersForBinding;
window.changeMonth = changeMonth;
window.changeCalendarMonth = changeCalendarMonth;
window.switchTransactionView = switchTransactionView;
window.switchEventTab = switchEventTab;
window.showDateEvent = showDateEvent;
window.closeDateEventModal = closeDateEventModal;
window.saveDateEvent = saveDateEvent;
window.viewAIEvent = viewAIEvent;
window.closeAIEventModal = closeAIEventModal;
window.viewCalendarNotification = viewCalendarNotification;
window.closeCalendarNotification = closeCalendarNotification;