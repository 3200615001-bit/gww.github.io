// 个人模块完整代码
window.PersonalModule = {
    // 当前激活的section
    currentSection: null,
    
    // 初始化函数
    init() {
        this.loadUserPersona();
        this.bindEvents();
    },
    
    // 绑定事件
    bindEvents() {
        // 人设头像上传
        const avatarInput = document.getElementById('personaAvatar');
        if (avatarInput) {
            avatarInput.addEventListener('change', this.handleAvatarUpload);
        }
        
        // 事件类型切换
        const eventType = document.getElementById('eventType');
        if (eventType) {
            eventType.addEventListener('change', this.handleEventTypeChange);
        }
    },
    
    // 加载用户人设
    loadUserPersona() {
        const saved = localStorage.getItem('currentUserPersona');
        if (saved) {
            window.currentUserPersona = JSON.parse(saved);
        }
    },
    
    // 获取账户余额
    getAccountBalance() {
        const saved = localStorage.getItem('accountBalance');
        return saved ? parseFloat(saved) : 10000;
    },
    
    // 添加交易记录
    addTransaction(type, amount, description, relatedId) {
        const transactions = JSON.parse(localStorage.getItem('transactions') || '[]');
        const balance = this.getAccountBalance();
        
        const newBalance = type === 'income' ? balance + amount : balance - amount;
        
        transactions.push({
            id: 'trans_' + Date.now(),
            type: type,
            amount: amount,
            description: description,
            relatedId: relatedId,
            date: new Date().toISOString(),
            balance: newBalance
        });
        
        localStorage.setItem('transactions', JSON.stringify(transactions));
        localStorage.setItem('accountBalance', newBalance.toString());
        
        // 更新显示
        this.updateAccountDisplay();
    },
    
    // 更新账户显示
    updateAccountDisplay() {
        const balanceElement = document.getElementById('accountBalance');
        if (balanceElement) {
            balanceElement.textContent = '¥' + this.getAccountBalance().toFixed(2);
        }
    },
    
    // 添加AI日历事件
    addAICalendarEvent(contactId, contactName, content, eventType) {
        const events = JSON.parse(localStorage.getItem('calendarEvents') || '{}');
        const today = new Date().toISOString().split('T')[0];
        
        if (!events[today]) {
            events[today] = [];
        }
        
        events[today].push({
            id: 'event_' + Date.now(),
            type: eventType,
            content: content,
            author: contactName,
            authorId: contactId,
            createdBy: 'ai',
            time: new Date().toLocaleTimeString()
        });
        
        localStorage.setItem('calendarEvents', JSON.stringify(events));
        
        // 显示通知
        this.showCalendarNotification(contactName, content);
    },
    
    // 显示日历通知
    showCalendarNotification(author, content) {
        const notification = document.getElementById('calendarNotification');
        if (notification) {
            document.getElementById('notificationTitle').textContent = '新的日历记录';
            document.getElementById('notificationMessage').textContent = `${author}: ${content}`;
            notification.style.display = 'block';
            
            setTimeout(() => {
                notification.style.display = 'none';
            }, 5000);
        }
    },
    
    // 检查日历提醒
    checkCalendarReminders() {
        const events = JSON.parse(localStorage.getItem('calendarEvents') || '{}');
        const today = new Date().toISOString().split('T')[0];
        const reminders = [];
        
        if (events[today]) {
            events[today].forEach(event => {
                if (event.reminderTime) {
                    reminders.push({
                        content: event.content,
                        reminderTime: event.reminderTime
                    });
                }
            });
        }
        
        return reminders;
    }
};

// 显示个人板块函数
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
    window.PersonalModule.currentSection = section;
    
    // 根据不同section执行初始化
    switch(section) {
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

// 加载人设列表
function loadPersonaList() {
    const personas = JSON.parse(localStorage.getItem('userPersonas') || '[]');
    const personaList = document.getElementById('personaList');
    
    if (personaList) {
        if (personas.length === 0) {
            personaList.innerHTML = '<p style="text-align: center; color: #999;">暂无人设，点击新建创建第一个</p>';
        } else {
            personaList.innerHTML = personas.map(persona => `
                <div class="persona-card ${persona.isCurrent ? 'active' : ''}" onclick="selectPersona('${persona.id}')">
                    <img src="${persona.avatar || 'default-avatar.png'}" class="persona-avatar">
                    <div class="persona-info">
                        <div class="persona-name">${persona.name}</div>
                        <div class="persona-gender">${persona.gender === 'male' ? '男' : persona.gender === 'female' ? '女' : '其他'}</div>
                    </div>
                    ${persona.isCurrent ? '<span class="current-badge">当前</span>' : ''}
                </div>
            `).join('');
        }
    }
}

// 加载账户数据
function loadAccountData() {
    // 更新余额显示
    window.PersonalModule.updateAccountDisplay();
    
    // 加载交易记录
    loadTransactionList();
    
    // 计算月度统计
    calculateMonthlyStats();
}

// 加载交易记录
function loadTransactionList() {
    const transactions = JSON.parse(localStorage.getItem('transactions') || '[]');
    const transactionList = document.getElementById('transactionList');
    
    if (transactionList) {
        if (transactions.length === 0) {
            transactionList.innerHTML = '<p style="text-align: center; color: #999;">暂无交易记录</p>';
        } else {
            // 按日期倒序排列
            transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
            
            transactionList.innerHTML = transactions.slice(0, 20).map(trans => `
                <div class="transaction-item ${trans.type}">
                    <div class="transaction-info">
                        <div class="transaction-desc">${trans.description}</div>
                        <div class="transaction-time">${new Date(trans.date).toLocaleString()}</div>
                    </div>
                    <div class="transaction-amount ${trans.type}">
                        ${trans.type === 'income' ? '+' : '-'}¥${trans.amount.toFixed(2)}
                    </div>
                </div>
            `).join('');
        }
    }
}

// 计算月度统计
function calculateMonthlyStats() {
    const transactions = JSON.parse(localStorage.getItem('transactions') || '[]');
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    let income = 0;
    let expense = 0;
    
    transactions.forEach(trans => {
        const transDate = new Date(trans.date);
        if (transDate.getMonth() === currentMonth && transDate.getFullYear() === currentYear) {
            if (trans.type === 'income') {
                income += trans.amount;
            } else {
                expense += trans.amount;
            }
        }
    });
    
    // 更新显示
    const incomeElement = document.getElementById('monthlyIncome');
    const expenseElement = document.getElementById('monthlyExpense');
    
    if (incomeElement) incomeElement.textContent = '¥' + income.toFixed(2);
    if (expenseElement) expenseElement.textContent = '¥' + expense.toFixed(2);
}

// 初始化日历
function initCalendar() {
    const currentDate = new Date();
    renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
    loadCalendarEvents();
}

// 渲染日历
function renderCalendar(year, month) {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const calendarDays = document.getElementById('calendarDays');
    
    if (!calendarDays) return;
    
    let html = '';
    
    // 添加空白天数
    for (let i = 0; i < firstDay; i++) {
        html += '<div class="calendar-day empty"></div>';
    }
    
    // 添加日期
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isToday = dateStr === new Date().toISOString().split('T')[0];
        
        html += `
            <div class="calendar-day ${isToday ? 'today' : ''}" data-date="${dateStr}" onclick="showDateEvents('${dateStr}')">
                <span class="day-number">${day}</span>
                <div class="day-events" id="events-${dateStr}"></div>
            </div>
        `;
    }
    
    calendarDays.innerHTML = html;
    
    // 更新月份显示
    const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    const calendarMonth = document.getElementById('calendarMonth');
    if (calendarMonth) {
        calendarMonth.textContent = `${year}年${monthNames[month]}`;
    }
}

// 加载日历事件
function loadCalendarEvents() {
    const events = JSON.parse(localStorage.getItem('calendarEvents') || '{}');
    
    Object.keys(events).forEach(date => {
        const dayEvents = events[date];
        const eventContainer = document.getElementById(`events-${date}`);
        
        if (eventContainer && dayEvents.length > 0) {
            eventContainer.innerHTML = dayEvents.slice(0, 3).map(event => 
                `<div class="event-dot ${event.type}"></div>`
            ).join('');
        }
    });
}

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    window.PersonalModule.init();
});



// 二次 补充函数
// 人设相关函数
function showCreatePersona() {
    document.getElementById('persona-form').style.display = 'block';
    document.getElementById('personaFormTitle').textContent = '新建人设';
    resetPersonaForm();
}

function resetPersonaForm() {
    document.getElementById('personaName').value = '';
    document.getElementById('personaBackground').value = '';
    document.getElementById('personaAvatarImg').src = '';
    document.getElementById('personaAvatarImg').style.display = 'none';
    document.getElementById('personaAvatarPlaceholder').style.display = 'block';
    document.querySelectorAll('input[name="personaGender"]').forEach(radio => radio.checked = false);
}

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
    
    const personas = JSON.parse(localStorage.getItem('userPersonas') || '[]');
    
    const newPersona = {
        id: 'persona_' + Date.now(),
        name: name,
        gender: gender,
        background: background,
        avatar: avatar || null,
        createdAt: new Date().toISOString(),
        isCurrent: personas.length === 0
    };
    
    personas.push(newPersona);
    localStorage.setItem('userPersonas', JSON.stringify(personas));
    
    if (newPersona.isCurrent) {
        localStorage.setItem('currentUserPersona', JSON.stringify(newPersona));
        window.currentUserPersona = newPersona;
    }
    
    cancelPersonaForm();
    loadPersonaList();
    alert('人设保存成功！');
}

function cancelPersonaForm() {
    document.getElementById('persona-form').style.display = 'none';
    resetPersonaForm();
}

function selectPersona(personaId) {
    const personas = JSON.parse(localStorage.getItem('userPersonas') || '[]');
    
    personas.forEach(persona => {
        persona.isCurrent = persona.id === personaId;
    });
    
    const selectedPersona = personas.find(p => p.id === personaId);
    if (selectedPersona) {
        localStorage.setItem('currentUserPersona', JSON.stringify(selectedPersona));
        window.currentUserPersona = selectedPersona;
    }
    
    localStorage.setItem('userPersonas', JSON.stringify(personas));
    loadPersonaList();
}

// 账户相关函数
function switchTransactionView(view) {
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // 这里可以根据view切换显示不同的交易记录
    if (view === 'daily') {
        // 显示每日收支
        loadDailyTransactions();
    } else {
        // 显示每月收支
        loadMonthlyTransactions();
    }
}

function changeMonth(direction) {
    // 实现月份切换逻辑
    const currentMonthElement = document.getElementById('currentMonth');
    // 解析当前月份并更新
    // 重新加载该月的交易数据
}

// 日历相关函数
function changeCalendarMonth(direction) {
    const calendarMonth = document.getElementById('calendarMonth');
    const currentText = calendarMonth.textContent;
    const match = currentText.match(/(\d{4})年(\d+)月/);
    
    if (match) {
        let year = parseInt(match[1]);
        let month = parseInt(match[2]) - 1;
        
        if (direction === -1) {
            month--;
            if (month < 0) {
                month = 11;
                year--;
            }
        } else {
            month++;
            if (month > 11) {
                month = 0;
                year++;
            }
        }
        
        renderCalendar(year, month);
        loadCalendarEvents();
    }
}

function switchEventTab(tab) {
    document.querySelectorAll('.event-tab').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // 根据tab筛选事件
    filterEventsByTab(tab);
}

function showDateEvents(dateStr) {
    const events = JSON.parse(localStorage.getItem('calendarEvents') || '{}');
    const dateEvents = events[dateStr] || [];
    
    if (dateEvents.length === 0) {
        // 显示添加事件界面
        showAddEventModal(dateStr);
    } else {
        // 显示事件列表
        showEventListModal(dateStr, dateEvents);
    }
}

function showAddEventModal(dateStr) {
    const modal = document.getElementById('dateEventModal');
    if (modal) {
        modal.style.display = 'flex';
        modal.dataset.date = dateStr;
        document.getElementById('dateEventTitle').textContent = `${dateStr} - 添加事件`;
    }
}

function closeDateEventModal() {
    const modal = document.getElementById('dateEventModal');
    if (modal) {
        modal.style.display = 'none';
        // 清空表单
        document.getElementById('eventType').value = 'normal';
        document.getElementById('eventContent').value = '';
        document.getElementById('eventReminderTime').value = '';
    }
}

function saveDateEvent() {
    const modal = document.getElementById('dateEventModal');
    const dateStr = modal.dataset.date;
    const type = document.getElementById('eventType').value;
    const content = document.getElementById('eventContent').value.trim();
    const reminderTime = document.getElementById('eventReminderTime').value;
    
    if (!content) {
        alert('请输入事件内容');
        return;
    }
    
    const events = JSON.parse(localStorage.getItem('calendarEvents') || '{}');
    if (!events[dateStr]) {
        events[dateStr] = [];
    }
    
    events[dateStr].push({
        id: 'event_' + Date.now(),
        type: type,
        content: content,
        reminderTime: reminderTime,
        createdBy: 'user',
        createdAt: new Date().toISOString()
    });
    
    localStorage.setItem('calendarEvents', JSON.stringify(events));
    
    closeDateEventModal();
    loadCalendarEvents();
    alert('事件添加成功！');
}

function closeAIEventModal() {
    const modal = document.getElementById('aiEventModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function viewCalendarNotification() {
    // 跳转到日历页面
    showPersonalSection('calendar');
    
    // 关闭通知
    closeCalendarNotification();
}

function closeCalendarNotification() {
    const notification = document.getElementById('calendarNotification');
    if (notification) {
        notification.style.display = 'none';
    }
}

// 头像上传处理
document.getElementById('personaAvatar')?.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            document.getElementById('personaAvatarImg').src = event.target.result;
            document.getElementById('personaAvatarImg').style.display = 'block';
            document.getElementById('personaAvatarPlaceholder').style.display = 'none';
        };
        reader.readAsDataURL(file);
    }
});

// 事件类型切换
document.getElementById('eventType')?.addEventListener('change', function() {
    const anniversaryOptions = document.getElementById('anniversaryOptions');
    if (this.value === 'anniversary') {
        anniversaryOptions.style.display = 'block';
    } else {
        anniversaryOptions.style.display = 'none';
    }
});



// 三次  补充账户的函数
// ========== 交易相关函数 ==========

// 加载每日交易记录
function loadDailyTransactions() {
    const transactions = JSON.parse(localStorage.getItem('transactions') || '[]');
    const today = new Date().toISOString().split('T')[0];
    
    // 筛选今日交易
    const todayTransactions = transactions.filter(trans => {
        const transDate = new Date(trans.date).toISOString().split('T')[0];
        return transDate === today;
    });
    
    displayTransactions(todayTransactions);
}

// 加载每月交易记录
function loadMonthlyTransactions() {
    const transactions = JSON.parse(localStorage.getItem('transactions') || '[]');
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    // 筛选本月交易
    const monthlyTransactions = transactions.filter(trans => {
        const transDate = new Date(trans.date);
        return transDate.getMonth() === currentMonth && 
               transDate.getFullYear() === currentYear;
    });
    
    // 按日期分组
    const groupedByDate = {};
    monthlyTransactions.forEach(trans => {
        const dateKey = new Date(trans.date).toLocaleDateString('zh-CN');
        if (!groupedByDate[dateKey]) {
            groupedByDate[dateKey] = [];
        }
        groupedByDate[dateKey].push(trans);
    });
    
    displayGroupedTransactions(groupedByDate);
}

// 显示交易记录
function displayTransactions(transactions) {
    const transactionList = document.getElementById('transactionList');
    if (!transactionList) return;
    
    if (transactions.length === 0) {
        transactionList.innerHTML = '<p style="text-align: center; color: #999;">暂无交易记录</p>';
        return;
    }
    
    // 按时间倒序排列
    transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    transactionList.innerHTML = transactions.map(trans => `
        <div class="transaction-item ${trans.type}">
            <div class="transaction-info">
                <div class="transaction-desc">${trans.description}</div>
                <div class="transaction-time">${new Date(trans.date).toLocaleTimeString()}</div>
            </div>
            <div class="transaction-amount ${trans.type}">
                ${trans.type === 'income' ? '+' : '-'}¥${trans.amount.toFixed(2)}
            </div>
        </div>
    `).join('');
}

// 显示分组交易记录
function displayGroupedTransactions(groupedTransactions) {
    const transactionList = document.getElementById('transactionList');
    if (!transactionList) return;
    
    const dates = Object.keys(groupedTransactions).sort((a, b) => 
        new Date(b) - new Date(a)
    );
    
    if (dates.length === 0) {
        transactionList.innerHTML = '<p style="text-align: center; color: #999;">本月暂无交易记录</p>';
        return;
    }
    
    transactionList.innerHTML = dates.map(date => {
        const dayTransactions = groupedTransactions[date];
        const dayIncome = dayTransactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0);
        const dayExpense = dayTransactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + t.amount, 0);
        
        return `
            <div class="transaction-day-group">
                <div class="transaction-day-header">
                    <span class="transaction-date">${date}</span>
                    <span class="transaction-day-summary">
                        收入: <span style="color: #4caf50;">¥${dayIncome.toFixed(2)}</span>
                        支出: <span style="color: #f44336;">¥${dayExpense.toFixed(2)}</span>
                    </span>
                </div>
                <div class="transaction-day-items">
                    ${dayTransactions.map(trans => `
                        <div class="transaction-item ${trans.type}">
                            <div class="transaction-info">
                                <div class="transaction-desc">${trans.description}</div>
                                <div class="transaction-time">${new Date(trans.date).toLocaleTimeString()}</div>
                            </div>
                            <div class="transaction-amount ${trans.type}">
                                ${trans.type === 'income' ? '+' : '-'}¥${trans.amount.toFixed(2)}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }).join('');
}

// ========== 日历事件相关函数 ==========

// 根据标签筛选事件
function filterEventsByTab(tab) {
    const events = JSON.parse(localStorage.getItem('calendarEvents') || '{}');
    const eventList = document.getElementById('eventList');
    if (!eventList) return;
    
    let allEvents = [];
    
    // 收集所有事件
    Object.keys(events).forEach(date => {
        events[date].forEach(event => {
            allEvents.push({
                ...event,
                date: date
            });
        });
    });
    
    // 根据tab筛选
    let filteredEvents = [];
    switch(tab) {
        case 'all':
            filteredEvents = allEvents;
            break;
        case 'mine':
            filteredEvents = allEvents.filter(e => e.createdBy === 'user');
            break;
        case 'ai':
            filteredEvents = allEvents.filter(e => e.createdBy === 'ai');
            break;
    }
    
    // 按日期倒序排列
    filteredEvents.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // 显示事件
    displayEventList(filteredEvents);
}

// 显示事件列表
function displayEventList(events) {
    const eventList = document.getElementById('eventList');
    if (!eventList) return;
    
    if (events.length === 0) {
        eventList.innerHTML = '<p style="text-align: center; color: #999;">暂无事件记录</p>';
        return;
    }
    
    eventList.innerHTML = events.map(event => {
        const eventTypeIcons = {
            'normal': '📝',
            'birthday': '🎂',
            'anniversary': '💝',
            'holiday': '🎉',
            'reminder': '⏰'
        };
        
        return `
            <div class="event-item ${event.type}" onclick="viewEventDetail('${event.id}', '${event.date}')">
                <div class="event-icon">${eventTypeIcons[event.type] || '📝'}</div>
                <div class="event-info">
                    <div class="event-content">${event.content}</div>
                    <div class="event-meta">
                        <span class="event-date">${event.date}</span>
                        ${event.reminderTime ? `<span class="event-time">⏰ ${event.reminderTime}</span>` : ''}
                        ${event.createdBy === 'ai' ? `<span class="event-author">由 ${event.author || 'AI'} 记录</span>` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// 查看事件详情
function viewEventDetail(eventId, date) {
    const events = JSON.parse(localStorage.getItem('calendarEvents') || '{}');
    const dayEvents = events[date] || [];
    const event = dayEvents.find(e => e.id === eventId);
    
    if (!event) return;
    
    if (event.createdBy === 'ai') {
        // 显示AI事件详情
        const modal = document.getElementById('aiEventModal');
        if (modal) {
            document.getElementById('aiEventAuthor').textContent = event.author || 'AI助手';
            document.getElementById('aiEventContent').textContent = event.content;
            document.getElementById('aiEventTime').textContent = `${date} ${event.time || ''}`;
            
            // 如果有头像信息
            const savedContacts = localStorage.getItem('chatContacts');
            if (savedContacts) {
                const contacts = JSON.parse(savedContacts);
                const contact = contacts.find(c => c.id === event.authorId);
                if (contact) {
                    document.getElementById('aiEventAvatar').src = contact.avatar;
                }
            }
            
            modal.style.display = 'flex';
        }
    } else {
        // 显示普通事件详情或编辑界面
        if (confirm('是否要编辑这个事件？')) {
            editEvent(eventId, date);
        }
    }
}

// 编辑事件
function editEvent(eventId, date) {
    const events = JSON.parse(localStorage.getItem('calendarEvents') || '{}');
    const dayEvents = events[date] || [];
    const event = dayEvents.find(e => e.id === eventId);
    
    if (!event || event.createdBy === 'ai') return;
    
    // 打开编辑模态框
    const modal = document.getElementById('dateEventModal');
    if (modal) {
        modal.style.display = 'flex';
        modal.dataset.date = date;
        modal.dataset.editId = eventId;
        
        document.getElementById('dateEventTitle').textContent = `${date} - 编辑事件`;
        document.getElementById('eventType').value = event.type;
        document.getElementById('eventContent').value = event.content;
        document.getElementById('eventReminderTime').value = event.reminderTime || '';
        
        // 如果是纪念日，显示开始日期
        if (event.type === 'anniversary' && event.startDate) {
            document.getElementById('anniversaryOptions').style.display = 'block';
            document.getElementById('anniversaryStartDate').value = event.startDate;
        }
    }
}

// 显示事件列表弹窗
function showEventListModal(dateStr, dateEvents) {
    // 创建事件列表弹窗
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>${dateStr} 的事件</h3>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
            </div>
            <div class="modal-body">
                <div class="date-events-list">
                    ${dateEvents.map(event => `
                        <div class="date-event-item ${event.type}">
                            <div class="event-content">${event.content}</div>
                            ${event.reminderTime ? `<div class="event-reminder">提醒时间: ${event.reminderTime}</div>` : ''}
                            ${event.createdBy === 'ai' ? `<div class="event-creator">由 ${event.author} 记录</div>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-confirm" onclick="this.closest('.modal-overlay').remove(); showAddEventModal('${dateStr}')">
                    添加新事件
                </button>
                <button class="btn-cancel" onclick="this.closest('.modal-overlay').remove()">
                    关闭
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}