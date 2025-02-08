const CryptoManager = {
    // 状态管理
    state: {
        currentPair: localStorage.getItem('currentCryptoPair') || 'BTC-USDT',
        favorites: JSON.parse(localStorage.getItem('cryptoFavorites') || '["BTC-USDT", "ETH-USDT"]'),
        maxFavorites: 6,  // 最多6个收藏
        socket: null,
        tvWidget: null,
        searchTimeout: null,
        tradingViewLoaded: false
    },

    // 初始化
    init: async function() {
        try {
            console.log('初始化加密货币管理器...');
            
            // 添加错误处理器来过滤掉特定警告
            const originalError = console.error;
            const originalWarn = console.warn;
            
            console.warn = function(...args) {
                // 忽略 TradingView 的状态验证警告
                if (args[0] && typeof args[0] === 'string' && 
                    (args[0].includes('The state with a data type: unknown') ||
                     args[0].includes('Property'))) {
                    return;
                }
                originalWarn.apply(console, args);
            };

            console.error = function(...args) {
                // 忽略特定的 TradingView 错误
                if (args[0] && typeof args[0] === 'string' && 
                    args[0].includes('The state with a data type: unknown')) {
                    return;
                }
                originalError.apply(console, args);
            };

            await this.initComponents();
            this.loadSavedState();
            this.bindEvents();
        } catch (error) {
            console.error('初始化失败:', error);
        }
    },

    // 加载保存的状态
    loadSavedState: function() {
        try {
            // 更新导航栏显示
            this.updateNavDisplay();
            
            // 立即获取当前交易对的价格
            this.fetchCurrentPrice(this.state.currentPair);
            
            // 渲染收藏列表
            this.renderFavorites();
            
            console.log('加载保存的状态:', {
                currentPair: this.state.currentPair,
                favorites: this.state.favorites
            });
        } catch (error) {
            console.error('加载保存的状态失败:', error);
        }
    },

    // 初始化所有组件
    initComponents: async function() {
        await Promise.all([
            this.initWebSocket(),
            this.initTradingView(),
        ]);
        this.renderUI();
    },

    // WebSocket 管理
    initWebSocket: function() {
        return new Promise((resolve) => {
            const wsUrl = 'wss://ws.okx.com:8443/ws/v5/public';
            
            if (this.state.socket) {
                this.state.socket.close();
            }

            this.state.socket = new WebSocket(wsUrl);
            
            this.state.socket.onopen = () => {
                console.log('WebSocket已连接');
                this.subscribeToPrice(this.state.currentPair);
                resolve();
            };

            this.state.socket.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.data?.[0]) {
                    this.updatePriceDisplay(data.data[0]);
                }
            };

            this.state.socket.onclose = () => {
                console.log('WebSocket断开，尝试重连...');
                setTimeout(() => this.initWebSocket(), 2000);
            };
        });
    },

    // TradingView 管理
    initTradingView: async function() {
        return new Promise((resolve) => {
            if (typeof TradingView === 'undefined') {
                const script = document.createElement('script');
                script.src = 'https://s3.tradingview.com/tv.js';
                script.async = true;
                script.onload = () => {
                    // 不要立即创建 widget，等待模态框显示时再创建
                    resolve();
                };
                document.head.appendChild(script);
            } else {
                resolve();
            }
        });
    },

    createTradingViewWidget: function() {
        console.log('开始创建 TradingView widget');
        const container = document.getElementById('tradingview_widget');
        if (!container) {
            console.error('找不到 tradingview_widget 容器');
            return;
        }

        // 清空容器
        container.innerHTML = '';

        const symbol = `OKX:${this.state.currentPair.replace('-', '')}`;
        console.log('创建图表，交易对:', symbol);

        try {
            // 使用最简化的配置
            this.state.tvWidget = new TradingView.widget({
                "width": "100%",
                "height": "100%",
                "symbol": symbol,
                "interval": "1",
                "timezone": "Asia/Shanghai",
                "theme": "light",
                "style": "1",
                "locale": "zh_CN",
                "toolbar_bg": "#f1f3f6",
                "enable_publishing": false,
                "allow_symbol_change": false,
                "container_id": "tradingview_widget",
                "autosize": true,
                "debug": false
            });

            console.log('TradingView widget 创建成功');
        } catch (error) {
            console.error('创建 TradingView widget 失败:', error);
        }
    },

    // UI 渲染
    renderUI: function() {
        this.renderFavorites();
        this.updateNavDisplay();
        this.updateModalTitle();
    },

    renderFavorites: function() {
        const listEl = document.getElementById('favoritesList');
        if (!listEl) return;

        listEl.innerHTML = this.state.favorites.map(pair => {
            const symbol = pair.split('-')[0];
            return `
                <button class="crypto-favorite-btn ${pair === this.state.currentPair ? 'active' : ''}" 
                        data-pair="${pair}">
                    <img src="${this.getCryptoIcon(symbol)}" 
                         alt="${symbol}" 
                         class="crypto-icon"
                         onerror="this.src='https://static.okx.com/cdn/oksupport/asset/currency/icon/default.png'"/>
                    ${symbol}
                </button>
            `;
        }).join('');
    },

    updateNavDisplay: function() {
        const symbol = this.state.currentPair.split('-')[0];
        const navDisplay = document.getElementById('cryptoDisplay');
        if (navDisplay) {
            navDisplay.innerHTML = `
                <img src="${this.getCryptoIcon(symbol)}" 
                     alt="${symbol}" 
                     class="crypto-icon"
                     onerror="this.src='https://static.okx.com/cdn/oksupport/asset/currency/icon/default.png'"/>
                <span id="cryptoSymbol">${symbol}</span>
                <span id="cryptoPrice">--</span>
                <span id="cryptoChange">--</span>
            `;
        }
    },

    updateModalTitle: function() {
        const titleEl = document.getElementById('cryptoChartModalLabel');
        if (titleEl) {
            titleEl.textContent = `${this.state.currentPair} 实时行情`;
        }
    },

    // 事件绑定
    bindEvents: function() {
        // 绑定加密货币显示点击事件
        const cryptoDisplay = document.getElementById('cryptoDisplay');
        if (cryptoDisplay) {
            cryptoDisplay.addEventListener('click', () => {
                this.showChartModal();
            });
        }

        // 绑定收藏按钮点击事件
        const favoritesList = document.getElementById('favoritesList');
        if (favoritesList) {
            favoritesList.addEventListener('click', (e) => {
                const btn = e.target.closest('.crypto-favorite-btn');
                if (btn) {
                    const pair = btn.dataset.pair;
                    this.switchPair(pair);
                }
            });
        }

        // 绑定模态框事件
        this.bindModalEvents();

        // 绑定搜索输入事件
        const searchInput = document.getElementById('cryptoSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                if (this.state.searchTimeout) {
                    clearTimeout(this.state.searchTimeout);
                }
                this.state.searchTimeout = setTimeout(() => {
                    this.searchCrypto(e.target.value);
                }, 300); // 300ms 防抖
            });
        }

        // 监听搜索模态框打开事件
        $('#addFavoriteModal').on('shown.bs.modal', () => {
            const searchInput = document.getElementById('cryptoSearch');
            if (searchInput) {
                searchInput.value = '';
                searchInput.focus();
                this.searchCrypto(); // 显示所有可用交易对
            }
        });
    },

    showChartModal: function() {
        $('#cryptoChartModal').modal('show');
    },

    initTradingViewIfNeeded: function() {
        console.log('初始化 TradingView');
        if (!this.state.tradingViewLoaded) {
            this.loadTradingViewScript()
                .then(() => {
                    console.log('TradingView 脚本加载完成');
                    this.createTradingViewWidget();
                })
                .catch(error => {
                    console.error('加载 TradingView 失败:', error);
                });
        } else {
            this.createTradingViewWidget();
        }
    },

    loadTradingViewScript: function() {
        return new Promise((resolve, reject) => {
            if (window.TradingView) {
                this.state.tradingViewLoaded = true;
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://s3.tradingview.com/tv.js';
            script.async = true;
            script.onload = () => {
                console.log('TradingView 脚本加载成功');
                this.state.tradingViewLoaded = true;
                resolve();
            };
            script.onerror = () => {
                reject(new Error('TradingView 脚本加载失败'));
            };
            document.head.appendChild(script);
        });
    },

    destroyTradingView: function() {
        if (this.state.tvWidget) {
            try {
                const container = document.getElementById('tradingview_widget');
                if (container) {
                    container.innerHTML = '';
                }
                this.state.tvWidget = null;
                console.log('TradingView widget 已销毁');
            } catch (error) {
                console.error('销毁 TradingView widget 失败:', error);
            }
        }
    },

    // 交易对切换
    switchPair: function(pair) {
        if (pair === this.state.currentPair) return;
        
        console.log('切换交易对:', pair);
        this.state.currentPair = pair;
        localStorage.setItem('currentCryptoPair', pair);

        // 立即获取新的价格数据
        this.fetchCurrentPrice(pair);

        // 更新导航栏显示
        this.updateNavDisplay();

        // 更新其他组件...
        this.updateFavoriteButtons();
        this.updateWebSocketSubscription(pair);
    },

    // 立即获取当前价格
    fetchCurrentPrice: async function(pair) {
        try {
            const response = await fetch(`https://www.okx.com/api/v5/market/ticker?instId=${pair}`);
            const data = await response.json();
            if (data.data && data.data[0]) {
                this.updatePrice(data.data[0]);
            }
        } catch (error) {
            console.error('获取价格失败:', error);
        }
    },

    // 更新价格显示
    updatePrice: function(data) {
        if (data.instId !== this.state.currentPair) return;

        const priceEl = document.getElementById('cryptoPrice');
        const changeEl = document.getElementById('cryptoChange');
        
        if (priceEl && data.last) {
            const price = parseFloat(data.last);
            priceEl.textContent = `$${price.toFixed(2)}`;
        }

        if (changeEl && data.open24h && data.last) {
            const openPrice = parseFloat(data.open24h);
            const lastPrice = parseFloat(data.last);
            const change = ((lastPrice - openPrice) / openPrice) * 100;
            const sign = change >= 0 ? '+' : '';
            
            changeEl.textContent = `${sign}${change.toFixed(2)}%`;
            changeEl.className = change >= 0 ? 'up' : 'down';
        }
    },

    // WebSocket 订阅管理
    subscribeToPrice: function(pair) {
        if (!this.state.socket || this.state.socket.readyState !== WebSocket.OPEN) return;

        const msg = {
            "op": "subscribe",
            "args": [{
                "channel": "tickers",
                "instId": pair
            }]
        };
        this.state.socket.send(JSON.stringify(msg));
    },

    // 价格显示更新
    updatePriceDisplay: function(data) {
        if (data.instId !== this.state.currentPair) return;

        const priceEl = document.getElementById('cryptoPrice');
        const changeEl = document.getElementById('cryptoChange');
        
        if (data.last && priceEl) {
            priceEl.textContent = `$${parseFloat(data.last).toFixed(2)}`;
        }

        if (data.open24h && data.last && changeEl) {
            const change = ((parseFloat(data.last) - parseFloat(data.open24h)) / parseFloat(data.open24h)) * 100;
            const sign = change >= 0 ? '+' : '';
            changeEl.textContent = `${sign}${change.toFixed(2)}%`;
            changeEl.className = change >= 0 ? 'up' : 'down';
        }
    },

    // 搜索加密货币
    searchCrypto: async function(query = '') {
        const listEl = document.getElementById('cryptoList');
        if (!listEl) return;

        listEl.innerHTML = '<div class="text-center py-3"><i class="fas fa-spinner fa-spin"></i> 加载中...</div>';

        try {
            const response = await fetch('https://www.okx.com/api/v5/public/instruments?instType=SPOT');
            const data = await response.json();
            
            if (!data.data) {
                listEl.innerHTML = '<div class="text-center py-3 text-danger">没有找到结果</div>';
                return;
            }

            const results = data.data
                .filter(item => {
                    if (item.quoteCcy !== 'USDT') return false;
                    if (query) {
                        const searchTerm = query.toLowerCase();
                        const baseCcy = item.baseCcy.toLowerCase();
                        return baseCcy.includes(searchTerm);
                    }
                    return true;
                })
                .sort((a, b) => {
                    if (query) {
                        const searchTerm = query.toLowerCase();
                        const aStartsWith = a.baseCcy.toLowerCase().startsWith(searchTerm);
                        const bStartsWith = b.baseCcy.toLowerCase().startsWith(searchTerm);
                        if (aStartsWith && !bStartsWith) return -1;
                        if (!aStartsWith && bStartsWith) return 1;
                    }
                    return a.baseCcy.localeCompare(b.baseCcy);
                })
                .slice(0, 100);

            listEl.innerHTML = results.map(item => {
                const pair = `${item.baseCcy}-${item.quoteCcy}`;
                const isAdded = this.state.favorites.includes(pair);
                return `
                    <div class="crypto-list-item ${isAdded ? 'already-added' : ''}"
                         data-pair="${pair}">
                        <div class="crypto-info">
                            <img src="${this.getCryptoIcon(item.baseCcy)}" 
                                 alt="${item.baseCcy}"
                                 class="crypto-icon"
                                 onerror="this.src='https://static.okx.com/cdn/oksupport/asset/currency/icon/default.png'"/>
                            <div>
                                <div class="crypto-name">${item.baseCcy}</div>
                                <div class="crypto-symbol">${pair}</div>
                            </div>
                        </div>
                        ${isAdded ? 
                            '<span class="text-muted">已添加</span>' : 
                            '<button class="btn btn-sm btn-outline-primary add-btn">添加</button>'}
                    </div>
                `;
            }).join('');

            this.bindSearchResultEvents();

        } catch (error) {
            console.error('搜索失败:', error);
            listEl.innerHTML = '<div class="text-center py-3 text-danger">搜索失败，请重试</div>';
        }
    },

    // 高亮搜索词
    highlightSearchTerm: function(text, query) {
        if (!query) return text;
        const regex = new RegExp(`(${query})`, 'gi');
        return text.replace(regex, '<span class="highlight">$1</span>');
    },

    // 绑定搜索结果的点击事件
    bindSearchResultEvents: function() {
        const listEl = document.getElementById('cryptoList');
        if (!listEl) return;

        listEl.querySelectorAll('.crypto-list-item:not(.already-added)').forEach(item => {
            const addBtn = item.querySelector('.add-btn');
            if (addBtn) {
                addBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const pair = item.dataset.pair;
                    this.addToFavorites(pair);
                });
            }
        });
    },

    // 添加到收藏
    addToFavorites: function(pair) {
        if (this.state.favorites.length >= this.state.maxFavorites) {
            alert(`最多只能添加 ${this.state.maxFavorites} 个收藏`);
            return;
        }

        if (!this.state.favorites.includes(pair)) {
            this.state.favorites.push(pair);
            // 保存到localStorage
            this.saveState();
            this.renderFavorites();
            this.searchCrypto(document.getElementById('cryptoSearch').value);
            $('#addFavoriteModal').modal('hide');
        }
    },

    // 从收藏中移除
    removeFromFavorites: function(pair) {
        const index = this.state.favorites.indexOf(pair);
        if (index > -1) {
            this.state.favorites.splice(index, 1);
            // 保存到localStorage
            this.saveState();
            this.renderFavorites();
        }
    },

    // 更新收藏按钮状态
    updateFavoriteButtons: function() {
        const buttons = document.querySelectorAll('.crypto-favorite-btn');
        buttons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.pair === this.state.currentPair);
        });
    },

    // 保存状态到localStorage
    saveState: function() {
        try {
            localStorage.setItem('currentCryptoPair', this.state.currentPair);
            localStorage.setItem('cryptoFavorites', JSON.stringify(this.state.favorites));
            console.log('状态已保存:', {
                currentPair: this.state.currentPair,
                favorites: this.state.favorites
            });
        } catch (error) {
            console.error('保存状态失败:', error);
        }
    },

    updateWebSocketSubscription: function(pair) {
        if (this.state.socket && this.state.socket.readyState === WebSocket.OPEN) {
            // 取消订阅旧的交易对
            const unsubMsg = {
                "op": "unsubscribe",
                "args": [{
                    "channel": "tickers",
                    "instId": this.state.currentPair
                }]
            };
            this.state.socket.send(JSON.stringify(unsubMsg));

            // 订阅新的交易对
            const subMsg = {
                "op": "subscribe",
                "args": [{
                    "channel": "tickers",
                    "instId": pair
                }]
            };
            this.state.socket.send(JSON.stringify(subMsg));
        }
    },

    bindModalEvents: function() {
        const modal = document.getElementById('cryptoChartModal');
        const dialog = modal.querySelector('.modal-dialog');
        const header = modal.querySelector('.modal-header');
        
        let isDragging = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;
        let xOffset = 0;
        let yOffset = 0;

        // 初始化位置（居中）
        const initializePosition = () => {
            const rect = dialog.getBoundingClientRect();
            xOffset = (window.innerWidth - rect.width) / 2;
            yOffset = (window.innerHeight - rect.height) / 2;
            setTranslate(xOffset, yOffset, dialog);
        };

        // 设置位置
        const setTranslate = (xPos, yPos, el) => {
            el.style.transform = `translate(${xPos}px, ${yPos}px)`;
        };

        // 开始拖动
        const dragStart = (e) => {
            if (e.target.closest('.close')) return; // 忽略关闭按钮的点击
            
            initialX = e.type === 'touchstart' ? e.touches[0].clientX - xOffset : e.clientX - xOffset;
            initialY = e.type === 'touchstart' ? e.touches[0].clientY - yOffset : e.clientY - yOffset;

            if (e.target === header || e.target.closest('.modal-header')) {
                isDragging = true;
            }
        };

        // 拖动中
        const drag = (e) => {
            if (!isDragging) return;
            
            e.preventDefault();
            
            currentX = e.type === 'touchmove' ? e.touches[0].clientX - initialX : e.clientX - initialX;
            currentY = e.type === 'touchmove' ? e.touches[0].clientY - initialY : e.clientY - initialY;

            xOffset = currentX;
            yOffset = currentY;

            setTranslate(currentX, currentY, dialog);
        };

        // 结束拖动
        const dragEnd = () => {
            isDragging = false;
        };

        // 监听模态框显示事件
        $(modal).on('show.bs.modal', () => {
            console.log('模态框显示');
            this.initTradingViewIfNeeded();
            setTimeout(initializePosition, 0);
        });

        // 监听模态框隐藏事件
        $(modal).on('hidden.bs.modal', () => {
            console.log('模态框关闭');
            this.destroyTradingView();
        });

        // 添加拖动事件监听
        header.addEventListener('mousedown', dragStart);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', dragEnd);
        
        // 触摸设备支持
        header.addEventListener('touchstart', dragStart);
        document.addEventListener('touchmove', drag);
        document.addEventListener('touchend', dragEnd);

        // 窗口大小改变时重新定位
        window.addEventListener('resize', () => {
            if ($(modal).is(':visible')) {
                const rect = dialog.getBoundingClientRect();
                // 确保窗口在可视区域内
                if (rect.right > window.innerWidth) {
                    xOffset = window.innerWidth - rect.width;
                    setTranslate(xOffset, yOffset, dialog);
                }
                if (rect.bottom > window.innerHeight) {
                    yOffset = window.innerHeight - rect.height;
                    setTranslate(xOffset, yOffset, dialog);
                }
            }
        });

        // 阻止模态框的默认拖动行为
        dialog.addEventListener('mousedown', (e) => {
            if (e.target === dialog) {
                e.preventDefault();
            }
        });
    },

    getCryptoIcon: function(symbol) {
        // 统一转换为小写
        const lowerSymbol = symbol.toLowerCase();
        return `https://static.okx.com/cdn/oksupport/asset/currency/icon/${lowerSymbol}.png`;
    }
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    CryptoManager.init();
});
