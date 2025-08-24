// ==================== 个人设置模块 ====================
// 个人设置模块，包含人设管理、账户管理和日历功能    还有一部分代码在AI管理！
// 全局变量
let personas = []; // 人设列表
let currentPersona = null; // 当前编辑的人设
let currentEditingPersonaId = null; // 当前编辑的人设ID
let accountBalance = 10000; // 账户余额（初始10000元）
let transactions = []; // 交易记录
let calendarEvents = {}; // 日历事件 {date: [events]}
let currentCalendarDate = new Date(); // 当前日历显示的月份
let currentTransactionView = 'daily'; // 当前交易视图
let currentTransactionMonth = new Date(); // 当前查看的交易月份

// 初始化个人设置模块
function initPersonalModule() {
    loadPersonas();
    loadTransactions();
    loadCalendarEvents();

    // 绑定头像上传事件
    const avatarInput = document.getElementById('personaAvatar');
    if (avatarInput) {
        avatarInput.addEventListener('change', handlePersonaAvatarUpload);
    }

    // 绑定事件类型切换
    const eventTypeSelect = document.getElementById('eventType');
    if (eventTypeSelect) {
        eventTypeSelect.addEventListener('change', handleEventTypeChange);
    }
}

// ==================== 人设管理功能 ====================

// 加载人设数据
function loadPersonas() {
    const saved = localStorage.getItem('userPersonas');
    if (saved) {
        personas = JSON.parse(saved);
    }
}

// 保存人设数据
function savePersonasData() {
    localStorage.setItem('userPersonas', JSON.stringify(personas));
}

// 显示个人设置区块
function showPersonalSection(section) {
    // 隐藏所有区块
    document.querySelectorAll('.personal-section').forEach(sec => {
        sec.style.display = 'none';
    });

    // 显示选中的区块
    const sectionElement = document.getElementById(`${section}-section`);
    if (sectionElement) {
        sectionElement.style.display = 'block';

        // 根据不同区块初始化
        switch (section) {
            case 'persona':
                renderPersonaList();
                loadCharactersForBinding();
                break;
            case 'account':
                updateAccountDisplay();
                renderTransactionList();
                break;
            case 'calendar':
                renderCalendar();
                renderEventList();
                break;
        }
    }
}

// 显示创建人设表单
function showCreatePersona() {
    document.getElementById('persona-form').style.display = 'block';
    document.getElementById('personaFormTitle').textContent = '新建人设';
    resetPersonaForm();
    loadCharactersForBinding();
}

// 重置人设表单
function resetPersonaForm() {
    document.getElementById('personaName').value = '';
    // 方法3：更清晰的做法 - 直接取消所有该组单选按钮的选中状态
    document.querySelectorAll('input[name="personaGender"]').forEach(radio => {
        radio.checked = false;
    });
    document.getElementById('personaBackground').value = '';
    document.getElementById('personaAvatarImg').style.display = 'none';
    document.getElementById('personaAvatarPlaceholder').style.display = 'block';
    document.getElementById('personaAvatarImg').src = '';
    currentEditingPersonaId = null;

    // 清除角色选择
    document.querySelectorAll('.bind-character-item').forEach(item => {
        item.classList.remove('selected');
    });
}

// 处理头像上传
function handlePersonaAvatarUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        document.getElementById('personaAvatarImg').src = e.target.result;
        document.getElementById('personaAvatarImg').style.display = 'block';
        document.getElementById('personaAvatarPlaceholder').style.display = 'none';
    };
    reader.readAsDataURL(file);
}

// 加载可绑定的角色
function loadCharactersForBinding() {
    const grid = document.getElementById('characterBindGrid');
    const savedContacts = localStorage.getItem('chatContacts');
    const contacts = savedContacts ? JSON.parse(savedContacts) : [];

    if (contacts.length === 0) {
        grid.innerHTML = '<p style="color: #999; text-align: center;">暂无可绑定的角色</p>';
        return;
    }

    grid.innerHTML = contacts.map(contact => `
        <div class="bind-character-item" data-char-id="${contact.id}" data-char-name="${contact.name}" onclick="toggleCharacterBinding('${contact.id}')">
            <img src="${contact.avatar}" alt="${contact.name}">
            <span>${contact.name}</span>
        </div>
    `).join('');
}

// 切换角色绑定状态
function toggleCharacterBinding(charId) {
    const item = document.querySelector(`[data-char-id="${charId}"]`);
    if (item) {
        item.classList.toggle('selected');
    }
}

// 保存人设
function savePersona() {
    const name = document.getElementById('personaName').value.trim();
    const gender = document.querySelector('input[name="personaGender"]:checked')?.value;
    const background = document.getElementById('personaBackground').value.trim();
    const avatar = document.getElementById('personaAvatarImg').src;

    if (!name) {
        alert('请输入名字');
        return;
    }

    if (!gender) {
        alert('请选择性别');
        return;
    }

    if (!avatar || avatar.includes('placeholder')) {
        alert('请上传头像');
        return;
    }

    // 获取绑定的角色
    const boundCharacters = [];
    document.querySelectorAll('.bind-character-item.selected').forEach(item => {
        boundCharacters.push({
            id: item.dataset.charId,
            name: item.dataset.charName
        });
    });

    const persona = {
        id: currentEditingPersonaId || 'persona_' + Date.now(),
        name: name,
        gender: gender,
        background: background,
        avatar: avatar,
        boundCharacters: boundCharacters,
        createdAt: currentEditingPersonaId ?
            personas.find(p => p.id === currentEditingPersonaId)?.createdAt :
            new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isActive: false // 默认不激活
    };

    if (currentEditingPersonaId) {
        // 编辑现有人设
        const index = personas.findIndex(p => p.id === currentEditingPersonaId);
        if (index !== -1) {
            personas[index] = { ...personas[index], ...persona };
        }
    } else {
        // 创建新人设
        personas.push(persona);
    }

    savePersonasData();
    applyPersonaToAI(persona);

    alert('人设保存成功！');
    document.getElementById('persona-form').style.display = 'none';
    renderPersonaList();
}

// 取消人设表单
function cancelPersonaForm() {
    if (confirm('确定要取消吗？未保存的内容将会丢失。')) {
        document.getElementById('persona-form').style.display = 'none';
    }
}

// 渲染人设列表
function renderPersonaList() {
    const list = document.getElementById('personaList');

    if (personas.length === 0) {
        list.innerHTML = '<p style="color: #999; text-align: center;">暂无人设，点击"新建人设"创建第一个</p>';
        return;
    }

    list.innerHTML = personas.map(persona => `
        <div class="persona-card ${persona.isActive ? 'active' : ''}" onclick="selectPersona('${persona.id}')">
            <div class="persona-actions">
                <button class="persona-btn" onclick="event.stopPropagation(); editPersona('${persona.id}')" title="编辑">
                    ✏️
                </button>
                <button class="persona-btn" onclick="event.stopPropagation(); deletePersona('${persona.id}')" title="删除">
                    🗑️
                </button>
            </div>
            <div class="persona-avatar">
                <img src="${persona.avatar}" alt="${persona.name}">
            </div>
            <div class="persona-name">${persona.name}</div>
            <div class="persona-gender">${getGenderText(persona.gender)}</div>
            <div class="persona-characters">
                ${persona.boundCharacters.map(char =>
        `<span class="persona-char-tag">${char.name}</span>`
    ).join('') || '<span style="color: #999; font-size: 12px;">未绑定角色</span>'}
            </div>
        </div>
    `).join('');
}

// 获取性别文本
function getGenderText(gender) {
    const genderMap = {
        'male': '男',
        'female': '女',
        'other': '其他'
    };
    return genderMap[gender] || '未知';
}

// 选择激活人设
function selectPersona(personaId) {
    // 取消所有人设的激活状态
    personas.forEach(p => p.isActive = false);

    // 激活选中的人设
    const persona = personas.find(p => p.id === personaId);
    if (persona) {
        persona.isActive = true;
        savePersonasData();

        // 应用人设到AI系统
        applyPersonaToAI(persona);

        // 更新显示
        renderPersonaList();

        alert(`已切换到人设：${persona.name}`);
    }
}

// 编辑人设
function editPersona(personaId) {
    const persona = personas.find(p => p.id === personaId);
    if (!persona) return;

    currentEditingPersonaId = personaId;

    // 填充表单
    document.getElementById('personaFormTitle').textContent = '编辑人设';
    document.getElementById('personaName').value = persona.name;
    document.querySelector(`input[name="personaGender"][value="${persona.gender}"]`).checked = true;
    document.getElementById('personaBackground').value = persona.background || '';

    if (persona.avatar) {
        document.getElementById('personaAvatarImg').src = persona.avatar;
        document.getElementById('personaAvatarImg').style.display = 'block';
        document.getElementById('personaAvatarPlaceholder').style.display = 'none';
    }

    // 显示表单
    document.getElementById('persona-form').style.display = 'block';

    // 加载并选中绑定的角色
    loadCharactersForBinding();
    setTimeout(() => {
        persona.boundCharacters.forEach(char => {
            const item = document.querySelector(`[data-char-id="${char.id}"]`);
            if (item) {
                item.classList.add('selected');
            }
        });
    }, 100);
}

// 删除人设
function deletePersona(personaId) {
    if (!confirm('确定要删除这个人设吗？')) return;

    personas = personas.filter(p => p.id !== personaId);
    savePersonasData();
    renderPersonaList();

    alert('人设已删除');
}

// ==================== 账户管理功能 ====================

// 加载交易记录
function loadTransactions() {
    const saved = localStorage.getItem('accountTransactions');
    if (saved) {
        transactions = JSON.parse(saved);
        // 计算当前余额
        accountBalance = 10000; // 初始金额
        transactions.forEach(t => {
            if (t.type === 'income') {
                accountBalance += t.amount;
            } else {
                accountBalance -= t.amount;
            }
        });
    }
}

// 保存交易记录
function saveTransactionsData() {
    localStorage.setItem('accountTransactions', JSON.stringify(transactions));
    localStorage.setItem('accountBalance', accountBalance);
}

// 添加交易记录
function addTransaction(type, amount, description, fromCharacter = null) {
    const transaction = {
        id: 'trans_' + Date.now(),
        type: type, // 'income' or 'expense'
        amount: amount,
        description: description,
        fromCharacter: fromCharacter,
        date: new Date().toISOString(),
        timestamp: Date.now()
    };

    transactions.push(transaction);

    // 更新余额
    if (type === 'income') {
        accountBalance += amount;
    } else {
        accountBalance -= amount;
    }

    saveTransactionsData();

    // 如果在账户页面，更新显示
    if (document.getElementById('account-section').style.display !== 'none') {
        updateAccountDisplay();
        renderTransactionList();
    }
}

// 更新账户显示
function updateAccountDisplay() {
    document.getElementById('accountBalance').textContent = `¥${accountBalance.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

    // 计算本月收支
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let monthlyIncome = 0;
    let monthlyExpense = 0;

    transactions.forEach(t => {
        const tDate = new Date(t.date);
        if (tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear) {
            if (t.type === 'income') {
                monthlyIncome += t.amount;
            } else {
                monthlyExpense += t.amount;
            }
        }
    });

    document.getElementById('monthlyIncome').textContent = `¥${monthlyIncome.toFixed(2)}`;
    document.getElementById('monthlyExpense').textContent = `¥${monthlyExpense.toFixed(2)}`;
}

// 切换交易视图
function switchTransactionView(view) {
    currentTransactionView = view;

    // 更新按钮状态
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');

    renderTransactionList();
}

// 改变查看月份
function changeMonth(direction) {
    currentTransactionMonth.setMonth(currentTransactionMonth.getMonth() + direction);
    document.getElementById('currentMonth').textContent =
        `${currentTransactionMonth.getFullYear()}年${currentTransactionMonth.getMonth() + 1}月`;
    renderTransactionList();
}

// 渲染交易列表
function renderTransactionList() {
    const list = document.getElementById('transactionList');
    let filteredTransactions = [...transactions];

    // 根据当前月份筛选
    const currentMonth = currentTransactionMonth.getMonth();
    const currentYear = currentTransactionMonth.getFullYear();

    filteredTransactions = filteredTransactions.filter(t => {
        const tDate = new Date(t.date);
        return tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear;
    });

    // 根据视图类型分组
    if (currentTransactionView === 'daily') {
        // 按日期分组
        const grouped = {};
        filteredTransactions.forEach(t => {
            const date = new Date(t.date).toLocaleDateString('zh-CN');
            if (!grouped[date]) {
                grouped[date] = [];
            }
            grouped[date].push(t);
        });

        // 渲染每日交易
        let html = '';
        Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a)).forEach(date => {
            html += `<div class="transaction-day">
                <div class="transaction-date">${date}</div>`;

            grouped[date].forEach(t => {
                html += renderTransactionItem(t);
            });

            html += '</div>';
        });

        list.innerHTML = html || '<p style="color: #999; text-align: center; padding: 50px;">本月暂无交易记录</p>';
    } else {
        // 月度汇总视图
        renderMonthlyStatistics();
    }
}

// 渲染单个交易项
function renderTransactionItem(transaction) {
    const contact = transaction.fromCharacter ?
        JSON.parse(localStorage.getItem('chatContacts') || '[]').find(c => c.id === transaction.fromCharacter) :
        null;

    return `
        <div class="transaction-item">
            <div class="transaction-info">
                ${contact ? `
                    <div class="transaction-avatar">
                        <img src="${contact.avatar}" alt="${contact.name}">
                    </div>
                ` : ''}
                <div>
                    <div class="transaction-desc">${transaction.description}</div>
                    ${contact ? `<div class="transaction-from">来自: ${contact.name}</div>` : ''}
                </div>
            </div>
            <div class="transaction-amount">
                <div class="amount-value ${transaction.type}">
                    ${transaction.type === 'income' ? '+' : '-'}¥${transaction.amount.toFixed(2)}
                </div>
                <div class="transaction-time">
                    ${new Date(transaction.date).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                </div>
            </div>
        </div>
    `;
}

// 渲染月度统计
function renderMonthlyStatistics() {
    const list = document.getElementById('transactionList');
    // 这里可以添加月度统计图表等
    list.innerHTML = '<p style="color: #999; text-align: center; padding: 50px;">月度统计功能开发中...</p>';
}

// ==================== 日历功能 ====================

// 加载日历事件
function loadCalendarEvents() {
    const saved = localStorage.getItem('calendarEvents');
    if (saved) {
        calendarEvents = JSON.parse(saved);
    }
}

// 保存日历事件
function saveCalendarEvents() {
    localStorage.setItem('calendarEvents', JSON.stringify(calendarEvents));
}

// 改变日历月份
function changeCalendarMonth(direction) {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + direction);
    renderCalendar();
}

// 渲染日历
function renderCalendar() {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();

    // 更新月份显示
    document.getElementById('calendarMonth').textContent = `${year}年${month + 1}月`;

    // 获取该月第一天和最后一天
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const prevLastDay = new Date(year, month, 0);

    // 获取第一天是星期几
    const firstDayOfWeek = firstDay.getDay();

    // 计算需要显示的天数
    const daysInMonth = lastDay.getDate();
    const prevDaysToShow = firstDayOfWeek;
    const totalCells = Math.ceil((prevDaysToShow + daysInMonth) / 7) * 7;

    const calendarDays = document.getElementById('calendarDays');
    let html = '';

    // 上个月的日期
    for (let i = prevDaysToShow - 1; i >= 0; i--) {
        const date = prevLastDay.getDate() - i;
        html += renderCalendarDay(year, month - 1, date, true);
    }

    // 当前月的日期
    for (let date = 1; date <= daysInMonth; date++) {
        html += renderCalendarDay(year, month, date, false);
    }

    // 下个月的日期
    const nextDaysToShow = totalCells - prevDaysToShow - daysInMonth;
    for (let date = 1; date <= nextDaysToShow; date++) {
        html += renderCalendarDay(year, month + 1, date, true);
    }

    calendarDays.innerHTML = html;
}

// 渲染日历天
function renderCalendarDay(year, month, date, isOtherMonth) {
    const dateStr = formatDateString(year, month, date);
    const events = calendarEvents[dateStr] || [];
    const today = new Date();
    const isToday = year === today.getFullYear() &&
        month === today.getMonth() &&
        date === today.getDate();

    let eventDots = '';
    const userEvents = events.filter(e => e.author === 'user');
    const aiEvents = events.filter(e => e.author !== 'user');
    const anniversaryEvents = events.filter(e => e.type === 'anniversary');

    if (userEvents.length > 0) eventDots += '<span class="event-dot user"></span>';
    if (aiEvents.length > 0) eventDots += '<span class="event-dot ai"></span>';
    if (anniversaryEvents.length > 0) eventDots += '<span class="event-dot anniversary"></span>';

    return `
        <div class="calendar-day ${isOtherMonth ? 'other-month' : ''} ${isToday ? 'today' : ''} ${events.length > 0 ? 'has-event' : ''}"
             onclick="showDateEvent('${dateStr}')">
            <div class="day-number">${date}</div>
            <div class="day-events">${eventDots}</div>
        </div>
    `;
}

// 格式化日期字符串
function formatDateString(year, month, date) {
    const m = month < 0 ? 11 : month > 11 ? 0 : month;
    const y = month < 0 ? year - 1 : month > 11 ? year + 1 : year;
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
}

// 显示日期事件编辑
function showDateEvent(dateStr) {
    currentEditingDate = dateStr;
    const modal = document.getElementById('dateEventModal');
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
    if (type === 'anniversary') {
        document.getElementById('anniversaryOptions').style.display = 'block';
    } else {
        document.getElementById('anniversaryOptions').style.display = 'none';
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

    // 通知AI系统
    notifyAIAboutCalendarEvent(event, currentEditingDate);

    // 关闭弹窗并刷新
    closeDateEventModal();
    renderCalendar();
    renderEventList();

    alert('事件保存成功！');
}

// 关闭日期事件弹窗
function closeDateEventModal() {
    document.getElementById('dateEventModal').style.display = 'none';
}

// 切换事件标签
function switchEventTab(tab) {
    // 更新标签状态
    document.querySelectorAll('.event-tab').forEach(t => {
        t.classList.remove('active');
    });
    event.target.classList.add('active');

    renderEventList(tab);
}

// 渲染事件列表
function renderEventList(filter = 'all') {
    const list = document.getElementById('eventList');
    const allEvents = [];

    // 收集所有事件
    Object.keys(calendarEvents).forEach(date => {
        calendarEvents[date].forEach(event => {
            allEvents.push({ ...event, date: date });
        });
    });

    // 过滤事件
    let filteredEvents = allEvents;
    if (filter === 'mine') {
        filteredEvents = allEvents.filter(e => e.author === 'user');
    } else if (filter === 'ai') {
        filteredEvents = allEvents.filter(e => e.author !== 'user');
    }

    // 按日期排序
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

    document.getElementById('aiEventAvatar').src = author?.avatar || '';
    document.getElementById('aiEventAuthor').textContent = event.authorName || 'AI';
    document.getElementById('aiEventContent').textContent = event.content;
    document.getElementById('aiEventTime').textContent = `记录时间：${new Date(event.createdAt).toLocaleString('zh-CN')}`;

    document.getElementById('aiEventModal').style.display = 'flex';
}

// 关闭AI事件弹窗
function closeAIEventModal() {
    document.getElementById('aiEventModal').style.display = 'none';
}

// ==================== AI系统集成功能 ====================

// 应用人设到AI系统
function applyPersonaToAI(persona) {
    // 获取当前激活的人设
    const activePersona = persona || personas.find(p => p.isActive);
    if (!activePersona) return;

    // 将人设信息保存到全局
    localStorage.setItem('currentUserPersona', JSON.stringify(activePersona));

    // 通知所有绑定的AI角色
    activePersona.boundCharacters.forEach(char => {
        // 这里需要与AI管理器集成
        if (window.AIManager) {
            const roleData = {
                userPersona: {
                    name: activePersona.name,
                    gender: activePersona.gender,
                    background: activePersona.background,
                    avatar: activePersona.avatar
                }
            };

            // 更新角色的用户认知
            AIManager.roleManager.updateRoleMemory(char.id, {
                userInfo: roleData,
                type: 'persona_update'
            });
        }
    });
}

// 通知AI关于日历事件
function notifyAIAboutCalendarEvent(event, date) {
    // 获取当前激活的人设
    const activePersona = personas.find(p => p.isActive);
    if (!activePersona) return;

    // 通知所有绑定的角色
    activePersona.boundCharacters.forEach(char => {
        if (window.AIManager) {
            AIManager.roleManager.updateRoleMemory(char.id, {
                calendarEvent: {
                    date: date,
                    content: event.content,
                    type: event.type,
                    reminderTime: event.reminderTime
                },
                type: 'calendar_event'
            });
        }
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
    if (document.getElementById('calendar-section').style.display !== 'none') {
        renderCalendar();
        renderEventList();
    }
}

// 显示日历通知
function showCalendarNotification(authorName, content) {
    document.getElementById('notificationTitle').textContent = `${authorName} 添加了日历记录`;
    document.getElementById('notificationMessage').textContent = content;
    document.getElementById('calendarNotification').style.display = 'block';

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
    document.getElementById('calendarNotification').style.display = 'none';
}

// ==================== 导出供全局使用 ====================

window.PersonalModule = {
    init: initPersonalModule,
    addTransaction: addTransaction,
    addAICalendarEvent: addAICalendarEvent,
    getActivePersona: () => personas.find(p => p.isActive),
    getAccountBalance: () => accountBalance,
    checkCalendarReminders: () => {
        // 检查今日提醒
        const today = new Date().toISOString().split('T')[0];
        const events = calendarEvents[today] || [];
        return events.filter(e => e.reminderTime);
    }
};

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', function () {
    // 当点击设置中的个人标签时初始化
    const personalTab = document.querySelector('[onclick*="showSettingsTab(\'personal\')"]');
    if (personalTab) {
        const originalClick = personalTab.onclick;
        personalTab.onclick = function () {
            if (originalClick) originalClick.call(this);
            initPersonalModule();
        };
    }
});


// 二次 增加补充
// 在个人.js文件中添加这个函数
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
    event.currentTarget.classList.add('active');

    // 根据不同section执行初始化
    switch (section) {
        case 'persona':
            loadPersonaList();
            break;
        case 'account':
            loadAccountData();
            break;
        case 'calendar':
            initCalendar();
            break;
    }
}
