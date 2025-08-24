// responsive-adapter.js - 增强版移动端适配器

(function() {
    'use strict';
    
    console.log('开始加载响应式适配器...');
    
    // 响应式适配器
    const ResponsiveAdapter = {
        // 设备检测
        device: {
            isMobile: false,
            isTablet: false,
            isDesktop: false,
            isTouch: false,
            isIOS: false,
            isAndroid: false,
            screenWidth: 0,
            screenHeight: 0
        },
        
        // 初始化
        init() {
            console.log('响应式适配器初始化开始...');
            this.detectDevice();
            this.setupViewport();
            this.bindEvents();
            this.applyGlobalStyles();
            this.enhanceTouchEvents();
            this.fixMobileIssues();
            this.fixButtonClicks();
            console.log('响应式适配器初始化完成', this.device);
        },
        
        // 检测设备类型
        detectDevice() {
            const width = window.innerWidth;
            const height = window.innerHeight;
            const ua = navigator.userAgent;
            
            this.device.screenWidth = width;
            this.device.screenHeight = height;
            this.device.isMobile = width <= 768;
            this.device.isTablet = width > 768 && width <= 1024;
            this.device.isDesktop = width > 1024;
            this.device.isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
            this.device.isIOS = /iPad|iPhone|iPod/.test(ua);
            this.device.isAndroid = /Android/.test(ua);
            
            // 添加设备类到body
            document.body.classList.remove('mobile', 'tablet', 'desktop', 'touch', 'ios', 'android');
            if (this.device.isMobile) document.body.classList.add('mobile');
            if (this.device.isTablet) document.body.classList.add('tablet');
            if (this.device.isDesktop) document.body.classList.add('desktop');
            if (this.device.isTouch) document.body.classList.add('touch');
            if (this.device.isIOS) document.body.classList.add('ios');
            if (this.device.isAndroid) document.body.classList.add('android');
        },
        
        // 设置视口
        setupViewport() {
            let viewport = document.querySelector('meta[name="viewport"]');
            if (!viewport) {
                viewport = document.createElement('meta');
                viewport.name = 'viewport';
                document.head.appendChild(viewport);
            }
            viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
        },
        
        // 绑定事件
        bindEvents() {
            // 窗口大小改变时重新检测
            let resizeTimer;
            window.addEventListener('resize', () => {
                clearTimeout(resizeTimer);
                resizeTimer = setTimeout(() => {
                    this.detectDevice();
                    this.applyGlobalStyles();
                }, 250);
            });
            
            // 屏幕方向改变
            window.addEventListener('orientationchange', () => {
                setTimeout(() => {
                    this.detectDevice();
                    this.applyGlobalStyles();
                }, 100);
            });
        },
        
        // 应用全局样式
        applyGlobalStyles() {
            const styleId = 'responsive-global-styles';
            let styleElement = document.getElementById(styleId);
            
            if (!styleElement) {
                styleElement = document.createElement('style');
                styleElement.id = styleId;
                document.head.appendChild(styleElement);
            }
            
            const styles = `
                /* 全局响应式样式 */
                * {
                    -webkit-tap-highlight-color: transparent;
                    -webkit-touch-callout: none;
                    box-sizing: border-box;
                }
                
                /* 移动端基础优化 */
                .mobile {
                    -webkit-text-size-adjust: 100%;
                    -ms-text-size-adjust: 100%;
                }
                
                /* 移动端内容区域适配 */
                .mobile .content-area {
                    padding: 10px;
                    width: 100%;
                    overflow-x: hidden;
                }
                
                /* 修复移动端人设卡片 */
                .mobile .persona-card {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    padding: 15px;
                    margin-bottom: 10px;
                    width: 100%;
                    box-sizing: border-box;
                }
                
                .mobile .persona-card .persona-avatar {
                    width: 80px;
                    height: 80px;
                    margin-bottom: 10px;
                }
                
                .mobile .persona-card .persona-info {
                    text-align: center;
                    width: 100%;
                    margin-bottom: 10px;
                }
                
                .mobile .persona-card .persona-actions {
                    display: flex;
                    gap: 8px;
                    width: 100%;
                    justify-content: center;
                    flex-wrap: wrap;
                }
                
                .mobile .persona-card .persona-actions button,
                .mobile .persona-card .persona-actions .active-badge {
                    min-height: 40px;
                    padding: 8px 16px;
                    font-size: 14px;
                    border-radius: 20px;
                    border: none;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 5px;
                }
                
                /* 美化按钮样式 */
                .mobile .btn-activate {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                }
                
                .mobile .btn-edit {
                    background: linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%);
                    color: #333;
                }
                
                .mobile .btn-delete {
                    background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
                    color: white;
                }
                
                .mobile .active-badge {
                    background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%);
                    color: #333;
                    cursor: default;
                }
                
                /* 触摸设备优化 */
                .touch button,
                .touch .btn,
                .touch input[type="checkbox"],
                .touch input[type="radio"],
                .touch select,
                .touch .character-bind-item {
                    min-height: 44px;
                    cursor: pointer;
                    -webkit-tap-highlight-color: rgba(0,0,0,0.1);
                }
                
                /* 点击效果 */
                .touch button:active,
                .touch .btn:active {
                    transform: scale(0.95);
                    opacity: 0.8;
                }
                
                /* 移动端表单优化 */
                .mobile input,
                .mobile textarea,
                .mobile select {
                    font-size: 16px; /* 防止iOS缩放 */
                    padding: 12px;
                    width: 100%;
                    border: 1px solid #ddd;
                    border-radius: 8px;
                }
                
                /* 移动端模态框优化 */
                .mobile .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    z-index: 9999;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                .mobile .modal-content,
                .mobile .persona-form-container {
                    width: 90%;
                    max-width: none;
                    margin: 20px auto;
                    max-height: 85vh;
                    overflow-y: auto;
                    -webkit-overflow-scrolling: touch;
                }
                
                /* 修复日历在移动端的显示 */
                .mobile .calendar-container {
                    width: 100%;
                    overflow-x: auto;
                    -webkit-overflow-scrolling: touch;
                }
                
                .mobile .calendar-weekdays,
                .mobile .calendar-days {
                    min-width: 280px;
                    width: 100%;
                }
                
                .mobile .calendar-day {
                    min-width: 36px;
                    min-height: 36px;
                    font-size: 12px;
                }
                
                /* 平板优化 */
                .tablet .persona-card {
                    padding: 20px;
                }
                
                .tablet .persona-actions button {
                    padding: 10px 20px;
                    font-size: 15px;
                }
                
                /* 防止文字选中 */
                .touch * {
                    -webkit-user-select: none;
                    -moz-user-select: none;
                    -ms-user-select: none;
                    user-select: none;
                }
                
                .touch input,
                .touch textarea {
                    -webkit-user-select: text;
                    -moz-user-select: text;
                    -ms-user-select: text;
                    user-select: text;
                }
                
                /* 滚动优化 */
                .mobile .personal-section,
                .mobile .settings-content,
                .mobile .persona-list {
                    -webkit-overflow-scrolling: touch;
                    overflow-y: auto;
                    max-height: calc(100vh - 200px);
                }
                
                /* 确保按钮可点击 */
                button, .btn, [onclick], [data-action] {
                    position: relative;
                    z-index: 1;
                    cursor: pointer;
                }
                
                /* iOS安全区域适配 */
                @supports (padding: max(0px)) {
                    .mobile .content-area {
                        padding-left: max(10px, env(safe-area-inset-left));
                        padding-right: max(10px, env(safe-area-inset-right));
                        padding-bottom: max(10px, env(safe-area-inset-bottom));
                    }
                }
            `;
            
            styleElement.textContent = styles;
        },
        
        // 增强触摸事件
        enhanceTouchEvents() {
            if (!this.device.isTouch) return;
            
            // 使用事件委托优化触摸事件
            document.addEventListener('touchstart', function(e) {
                const target = e.target;
                
                // 为按钮添加触摸反馈
                if (target.matches('button, .btn, [data-action]')) {
                    target.style.opacity = '0.7';
                }
            }, { passive: true });
            
            document.addEventListener('touchend', function(e) {
                const target = e.target;
                
                // 恢复按钮样式
                if (target.matches('button, .btn, [data-action]')) {
                    setTimeout(() => {
                        target.style.opacity = '';
                    }, 100);
                }
            }, { passive: true });
        },
        
        // 修复移动端特定问题
        fixMobileIssues() {
            // 修复iOS Safari的滚动问题
            if (this.device.isIOS) {
                document.addEventListener('touchmove', function(e) {
                    const scrollable = e.target.closest('.modal-content, .persona-list, .settings-content');
                    if (!scrollable) {
                        e.preventDefault();
                    }
                }, { passive: false });
            }
            
            // 修复Android键盘弹出问题
            if (this.device.isAndroid) {
                const inputs = document.querySelectorAll('input, textarea');
                inputs.forEach(input => {
                    input.addEventListener('focus', function() {
                        setTimeout(() => {
                            const rect = this.getBoundingClientRect();
                            if (rect.bottom > window.innerHeight) {
                                this.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }
                        }, 300);
                    });
                });
            }
        },
        
        // 修复按钮点击问题
        fixButtonClicks() {
            // 使用事件委托处理所有按钮点击
            document.addEventListener('click', function(e) {
                const button = e.target.closest('button[data-action]');
                if (!button) return;
                
                const action = button.getAttribute('data-action');
                const index = button.getAttribute('data-index');
                
                console.log('按钮点击:', action, index);
                
                // 调用对应的全局函数
                switch(action) {
                    case 'activate':
                        if (window.activatePersona) window.activatePersona(parseInt(index));
                        break;
                    case 'edit':
                        if (window.editPersona) window.editPersona(parseInt(index));
                        break;
                    case 'delete':
                        if (window.deletePersona) window.deletePersona(parseInt(index));
                        break;
                }
            });
        }
    };
    
    // 导出到全局
    window.ResponsiveAdapter = ResponsiveAdapter;
    
    // DOM加载完成后自动初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => ResponsiveAdapter.init());
    } else {
        // 延迟执行确保其他脚本已加载
        setTimeout(() => ResponsiveAdapter.init(), 100);
    }
})();