// responsive-adapter.js - 全局响应式适配模块

(function() {
    'use strict';
    
    // 响应式适配器
    const ResponsiveAdapter = {
        // 设备检测
        device: {
            isMobile: false,
            isTablet: false,
            isDesktop: false,
            isTouch: false,
            screenWidth: 0,
            screenHeight: 0
        },
        
        // 初始化
        init() {
            this.detectDevice();
            this.setupViewport();
            this.bindEvents();
            this.applyGlobalStyles();
            this.enhanceTouchEvents();
            this.fixMobileIssues();
            
            console.log('响应式适配器初始化完成', this.device);
        },
        
        // 检测设备类型
        detectDevice() {
            const width = window.innerWidth;
            const height = window.innerHeight;
            
            this.device.screenWidth = width;
            this.device.screenHeight = height;
            this.device.isMobile = width <= 768;
            this.device.isTablet = width > 768 && width <= 1024;
            this.device.isDesktop = width > 1024;
            this.device.isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
            
            // 添加设备类到body
            document.body.classList.remove('mobile', 'tablet', 'desktop', 'touch');
            if (this.device.isMobile) document.body.classList.add('mobile');
            if (this.device.isTablet) document.body.classList.add('tablet');
            if (this.device.isDesktop) document.body.classList.add('desktop');
            if (this.device.isTouch) document.body.classList.add('touch');
        },
        
        // 设置视口
        setupViewport() {
            let viewport = document.querySelector('meta[name="viewport"]');
            if (!viewport) {
                viewport = document.createElement('meta');
                viewport.name = 'viewport';
                document.head.appendChild(viewport);
            }
            viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
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
                }
                
                /* 移动端优化 */
                .mobile {
                    -webkit-text-size-adjust: 100%;
                    -ms-text-size-adjust: 100%;
                }
                
                /* 触摸设备优化 */
                .touch button,
                .touch .btn,
                .touch .personal-action-btn,
                .touch .btn-edit,
                .touch .btn-delete,
                .touch .btn-activate,
                .touch input[type="checkbox"],
                .touch input[type="radio"],
                .touch select,
                .touch .character-bind-item {
                    min-height: 44px;
                    min-width: 44px;
                    cursor: pointer;
                }
                
                /* 移动端按钮间距 */
                .mobile .persona-actions {
                    gap: 8px;
                    display: flex;
                    flex-wrap: wrap;
                }
                
                .mobile .persona-actions button {
                    flex: 1;
                    min-width: 60px;
                    padding: 8px 12px;
                    font-size: 14px;
                }
                
                /* 移动端表单优化 */
                .mobile input,
                .mobile textarea,
                .mobile select {
                    font-size: 16px; /* 防止iOS缩放 */
                    padding: 12px;
                }
                
                /* 移动端复选框优化 */
                .mobile .character-bind-item {
                    padding: 12px;
                    margin: 4px;
                }
                
                .mobile .character-bind-item input[type="checkbox"] {
                    width: 20px;
                    height: 20px;
                    margin-right: 8px;
                }
                
                /* 移动端模态框优化 */
                .mobile .modal-content {
                    width: 90%;
                    max-width: none;
                    margin: 20px auto;
                    max-height: 90vh;
                    overflow-y: auto;
                }
                
                /* 移动端人设卡片优化 */
                .mobile .persona-card {
                    flex-direction: column;
                    padding: 15px;
                    text-align: center;
                }
                
                .mobile .persona-card .persona-avatar {
                    width: 80px;
                    height: 80px;
                    margin: 0 auto 10px;
                }
                
                .mobile .persona-card .persona-actions {
                    width: 100%;
                    margin-top: 10px;
                    justify-content: center;
                }
                
                /* 平板优化 */
                .tablet .personal-actions {
                    gap: 12px;
                }
                
                .tablet .persona-card {
                    padding: 20px;
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
                .mobile .settings-content {
                    -webkit-overflow-scrolling: touch;
                    overflow-y: auto;
                }
                
                /* 确保按钮可点击 */
                button, .btn, [onclick] {
                    position: relative;
                    z-index: 1;
                }
            `;
            
            styleElement.textContent = styles;
        },
        
        // 增强触摸事件
        enhanceTouchEvents() {
            if (!this.device.isTouch) return;
            
            // 将click事件转换为touch事件
            document.addEventListener('touchstart', function(e) {
                const target = e.target;
                
                // 处理带onclick属性的元素
                if (target.hasAttribute('onclick') || target.closest('[onclick]')) {
                    e.preventDefault();
                    
                    const element = target.hasAttribute('onclick') ? target : target.closest('[onclick]');
                    const onclickCode = element.getAttribute('onclick');
                    
                    // 延迟执行，模拟点击效果
                    setTimeout(() => {
                        try {
                            // 使用Function构造函数执行onclick代码
                            new Function('event', onclickCode).call(element, e);
                        } catch (error) {
                            console.error('执行onclick失败:', error);
                        }
                    }, 0);
                }
            }, { passive: false });
            
            // 优化复选框和单选框
            document.addEventListener('touchend', function(e) {
                const target = e.target;
                
                if (target.type === 'checkbox' || target.type === 'radio') {
                    e.preventDefault();
                    target.checked = !target.checked;
                    
                    // 触发change事件
                    const event = new Event('change', { bubbles: true });
                    target.dispatchEvent(event);
                }
            }, { passive: false });
        },
        
        // 修复移动端特定问题
        fixMobileIssues() {
            // 修复iOS Safari的滚动问题
            if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
                document.addEventListener('touchmove', function(e) {
                    if (e.target.closest('.modal-overlay')) {
                        e.preventDefault();
                    }
                }, { passive: false });
            }
            
            // 修复Android键盘弹出问题
            if (/Android/.test(navigator.userAgent)) {
                const inputs = document.querySelectorAll('input, textarea');
                inputs.forEach(input => {
                    input.addEventListener('focus', function() {
                        setTimeout(() => {
                            window.scrollTo(0, 0);
                            document.body.scrollTop = 0;
                        }, 300);
                    });
                });
            }
            
            // 确保模态框在移动端正确显示
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                        const target = mutation.target;
                        if (target.classList.contains('modal-overlay') && target.style.display === 'flex') {
                            // 确保模态框内容可滚动
                            const content = target.querySelector('.modal-content');
                            if (content && this.device.isMobile) {
                                content.style.maxHeight = '90vh';
                                content.style.overflowY = 'auto';
                            }
                        }
                    }
                });
            });
            
            // 观察所有模态框
            document.querySelectorAll('.modal-overlay').forEach(modal => {
                observer.observe(modal, { attributes: true });
            });
        },
        
        // 工具方法：安全执行函数
        safeExecute(funcName, ...args) {
            try {
                if (typeof window[funcName] === 'function') {
                    return window[funcName](...args);
                } else {
                    console.warn(`函数 ${funcName} 未定义`);
                }
            } catch (error) {
                console.error(`执行 ${funcName} 时出错:`, error);
            }
        }
    };
    
    // 导出到全局
    window.ResponsiveAdapter = ResponsiveAdapter;
    
    // DOM加载完成后自动初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => ResponsiveAdapter.init());
    } else {
        ResponsiveAdapter.init();
    }
})();