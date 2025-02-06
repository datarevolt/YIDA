// 计划管理模块
const PlansManager = {
    // 数据库操作
    db: {
        getAll: () => {
            return new Promise((resolve, reject) => {
                if (!db) reject('数据库未初始化');
                const transaction = db.transaction(['plans'], 'readonly');
                const store = transaction.objectStore('plans');
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject('获取计划列表失败');
            });
        },

        add: (plan) => {
            return new Promise((resolve, reject) => {
                if (!db) reject('数据库未初始化');
                const transaction = db.transaction(['plans'], 'readwrite');
                const store = transaction.objectStore('plans');
                // 添加自增ID和时间戳
                const newPlan = {
                    ...plan,
                    id: Date.now(), // 使用时间戳作为唯一ID
                    planTime: plan.planTime,
                    planTZ: TimeZoneManager.currentTimeZone,
                    createTime: new Date().toISOString()
                };
                const request = store.add(newPlan);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject('添加计划失败');
            });
        },

        delete: (id) => {
            return new Promise((resolve, reject) => {
                if (!db) reject('数据库未初始化');
                const transaction = db.transaction(['plans'], 'readwrite');
                const store = transaction.objectStore('plans');
                const request = store.delete(id);
                request.onsuccess = () => resolve();
                request.onerror = () => reject('删除计划失败');
            });
        },

        clear: () => {
            return new Promise((resolve, reject) => {
                if (!db) reject('数据库未初始化');
                const transaction = db.transaction(['plans'], 'readwrite');
                const store = transaction.objectStore('plans');
                const request = store.clear();
                request.onsuccess = () => resolve();
                request.onerror = () => reject('清除所有计划失败');
            });
        }
    },

    // 通知相关
    notification: {
        // 存储通知定时器的Map
        notificationTimers: new Map(),
        currentNotification: null,

        // 请求通知权限
        request: async () => {
            if (!("Notification" in window)) {
                console.warn('此浏览器不支持通知功能');
                return false;
            }
            if (Notification.permission === "granted") return true;
            if (Notification.permission !== "denied") {
                try {
                    const permission = await Notification.requestPermission();
                    return permission === "granted";
                } catch (error) {
                    console.warn('通知权限请求失败:', error);
                    return false;
                }
            }
            return false;
        },

        // 显示通知
        show: (plan, type = 'expired') => {
            if (Notification.permission !== "granted") return;

            try {
                const title = type === 'expired' ? 
                    "你有未确认的计划" : 
                    "你有即将到期的计划";
                
                const content = `用户：${plan.userId}\n计划内容：${plan.content}`;

                // 关闭之前的通知
                if (PlansManager.notification.currentNotification) {
                    PlansManager.notification.currentNotification.close();
                }

                // 创建新通知
                const notification = new Notification(title, {
                    body: content,
                    icon: "favicon.ico",
                    requireInteraction: true,  // 通知会一直显示直到用户手动关闭
                    silent: false,
                    tag: `plan_${plan.id}_${type}` // 添加类型标识
                });

                // 存储当前通知
                PlansManager.notification.currentNotification = notification;

                // 添加点击事件
                notification.onclick = () => {
                    window.focus();
                    notification.close();
                    // 如果不在计划页面，跳转到计划页面
                    if (!window.location.href.includes('plans.html')) {
                        window.location.href = 'plans.html';
                    }
                };
            } catch (error) {
                console.warn('显示通知失败:', error);
            }
        },

        // 开始重复通知
        startRepeatingNotification: (plan) => {
            // 如果已经有定时器在运行，先清除
            PlansManager.notification.clearNotificationTimer(plan.id);

            // 立即发送一次通知
            PlansManager.notification.show(plan, 'expired');

            // 创建新的定时器，每2分钟通知一次
            const timerId = setInterval(() => {
                // 检查是否已确认
                if (plan.status) {
                    PlansManager.notification.clearNotificationTimer(plan.id);
                } else {
                    PlansManager.notification.show(plan, 'expired');
                }
            }, 120000); // 2分钟

            // 存储定时器ID
            PlansManager.notification.notificationTimers.set(plan.id, timerId);
        },

        // 清除特定计划的通知定时器
        clearNotificationTimer: (planId) => {
            if (PlansManager.notification.notificationTimers.has(planId)) {
                clearInterval(PlansManager.notification.notificationTimers.get(planId));
                PlansManager.notification.notificationTimers.delete(planId);
            }
            // 如果当前通知是这个计划的，也关闭它
            if (PlansManager.notification.currentNotification?.tag?.includes(`plan_${planId}`)) {
                PlansManager.notification.currentNotification.close();
                PlansManager.notification.currentNotification = null;
            }
        },

        // 清除所有通知定时器
        clearAllTimers: () => {
            PlansManager.notification.notificationTimers.forEach(timerId => {
                clearInterval(timerId);
            });
            PlansManager.notification.notificationTimers.clear();
        }
    },

    // 时间处理
    time: {
        getRemaining: (planTime) => {
            const now = TimeZoneManager.getCurrentTime();
            const planDate = new Date(planTime);
            const diff = planDate - now;
            
            if (diff < 0) return '已过期';
            
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            
            if (days > 0) return `${days}天${hours}小时后到期`;
            if (hours > 0) return `${hours}小时${minutes}分钟后到期`;
            return `${minutes}分钟后到期`;
        },

        setDefault: () => {
            const now = TimeZoneManager.getCurrentTime();
            const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            const planTimeInput = document.getElementById('planTime');
            if (planTimeInput) planTimeInput.value = dateStr;
        }
    },

    // UI 更新
    ui: {
        updateNotifications: async () => {
            try {
                const plans = await PlansManager.db.getAll();
                const now = TimeZoneManager.getCurrentTime();
                const activePlans = plans.filter(plan => new Date(plan.planTime) > now);
                
                const planCount = document.getElementById('planCount');
                if (planCount) planCount.textContent = activePlans.length;
                
                const planList = document.getElementById('planList');
                if (planList) {
                    planList.innerHTML = activePlans.map(plan => `
                        <a href="#" class="dropdown-item">
                            <div class="text-sm">${plan.userId}</div>
                            <div class="text-sm text-muted">${plan.content}</div>
                            <div class="text-sm text-muted">剩余: ${PlansManager.time.getRemaining(plan.planTime)}</div>
                        </a>
                        <div class="dropdown-divider"></div>
                    `).join('') || '<div class="dropdown-item">暂无计划</div>';
                }
            } catch (error) {
                console.error('更新计划提醒失败：', error);
            }
        },

        updateTodoCard: (plans) => {
            const elements = {
                card: document.getElementById('todoCard'),
                count: document.getElementById('todoCount'),
                user: document.getElementById('todoUser'),
                content: document.getElementById('todoContent'),
                timeLeft: document.getElementById('todoTimeLeft')
            };

            if (!plans?.length) {
                // 更新UI为无计划状态
                if (elements.count) elements.count.textContent = '0';
                if (elements.user) elements.user.textContent = '';
                if (elements.content) elements.content.textContent = '暂无代办计划';
                if (elements.timeLeft) elements.timeLeft.textContent = '';
                if (elements.card) {
                    elements.card.classList.remove('bg-warning', 'bg-danger', 'bg-info');
                    elements.card.classList.add('bg-success');
                }
                return;
            }

            const now = TimeZoneManager.getCurrentTime();
            const nearestPlan = plans[0];
            const timeLeft = new Date(nearestPlan.planTime) - now;
            const isExpired = timeLeft < 0;

            // 更新计划内容和用户名
            if (elements.count) elements.count.textContent = plans.length.toString();
            if (elements.user) elements.user.textContent = nearestPlan.userId;
            if (elements.content) elements.content.textContent = nearestPlan.content;

            if (elements.timeLeft) {
                elements.timeLeft.innerHTML = `
                    ${isExpired && !nearestPlan.status ? 
                        `<button class="btn btn-sm btn-light confirm-plan" data-id="${nearestPlan.id}">
                            确认过期
                        </button>` : 
                        ''
                    }
                    <span class="ml-2">${PlansManager.time.getRemaining(nearestPlan.planTime)}</span>
                `;
            }

            // 更新卡片颜色
            if (elements.card) {
                elements.card.classList.remove('bg-success', 'bg-warning', 'bg-danger', 'bg-info');
                if (isExpired && !nearestPlan.status) {
                    elements.card.classList.add('bg-danger');
                } else if (timeLeft <= 600000) { // 10分钟内
                    elements.card.classList.add('bg-warning');
                } else {
                    elements.card.classList.add('bg-info');
                }
            }
        }
    },

    // 检查计划状态并发送通知
    checkTodoStatus: async () => {
        try {
            const plans = await PlansManager.db.getAll();
            if (!plans) return;

            const now = new Date();
            const activePlans = plans.filter(plan => {
                const planTime = new Date(plan.planTime);
                return planTime > new Date() || !plan.status;
            });

            // 更新UI
            PlansManager.ui.updateTodoCard(activePlans);
            
            // 检查通知状态
            plans.forEach(plan => {
                const timeLeft = new Date(plan.planTime) - now;
                if (timeLeft < 0 && !plan.status) {
                    PlansManager.notification.startRepeatingNotification(plan);
                }
            });

        } catch (error) {
            console.error('检查计划状态失败：', error);
        }
    },

    // 确认计划
    confirmExpired: async (planId) => {
        try {
            const transaction = db.transaction(['plans'], 'readwrite');
            const store = transaction.objectStore('plans');
            
            await new Promise((resolve, reject) => {
                const request = store.get(planId);
                
                request.onsuccess = () => {
                    const plan = request.result;
                    if (plan) {
                        plan.status = true;  // 更新状态为已确认
                        const putRequest = store.put(plan);
                        putRequest.onsuccess = () => resolve();
                        putRequest.onerror = () => reject(putRequest.error);
                    } else {
                        reject(new Error('计划不存在'));
                    }
                };
                request.onerror = () => reject(request.error);
            });

            // 清除该计划的通知定时器
            PlansManager.notification.clearNotificationTimer(planId);
            
            // 立即重新获取并更新数据
            const plans = await PlansManager.db.getAll();
            const activePlans = plans.filter(plan => {
                const planTime = new Date(plan.planTime);
                return planTime > new Date() || !plan.status;
            });
            
            // 更新UI
            PlansManager.ui.updateTodoCard(activePlans);
            
            // 如果在计划管理页面，刷新列表
            const tbody = document.getElementById('planTableBody');
            if (tbody) {
                await PlansManager.loadPlans();
            }
        } catch (error) {
            console.error('确认计划失败：', error);
            alert('确认计划失败：' + error.message);
        }
    },

    // 初始化
    init: async () => {
        try {
            // 确保数据库初始化
            if (!db) {
                await new Promise((resolve) => {
                    const request = indexedDB.open('FinanceDB', 3);  // 改为 FinanceDB 并使用正确的版本号
                    request.onupgradeneeded = (event) => {
                        const db = event.target.result;
                        if (!db.objectStoreNames.contains('plans')) {
                            db.createObjectStore('plans', { keyPath: 'id' });
                        }
                    };
                    request.onsuccess = () => {
                        window.db = request.result;
                        resolve();
                    };
                });
            }

            // 立即加载数据
            await PlansManager.loadPlans();

            // 设置定时器，每分钟更新一次
            PlansManager.updateTimer = setInterval(async () => {
                await PlansManager.checkTodoStatus();
            }, 60000);

            // 异步请求通知权限，不阻塞其他操作
            if (Notification.permission === "default") {
                setTimeout(() => {
                    PlansManager.notification.request().catch(console.warn);
                }, 1000);
            }

            // 页面关闭时清除所有定时器
            window.addEventListener('beforeunload', () => {
                PlansManager.notification.clearAllTimers();
                if (PlansManager.updateTimer) {
                    clearInterval(PlansManager.updateTimer);
                }
            });

            // 移除之前的事件绑定，重新绑定确认按钮事件
            $(document).off('click', '.confirm-plan');
            $(document).on('click', '.confirm-plan', async function(e) {
                e.preventDefault();  // 防止事件冒泡
                const planId = parseInt($(this).data('id'));
                if (!planId) {
                    console.error('无效的计划ID');
                    return;
                }
                
                try {
                    await PlansManager.confirmExpired(planId);
                } catch (error) {
                    console.error('确认计划失败：', error);
                    alert('确认计划失败：' + error.message);
                }
            });

            // 统一处理模态框事件
            $(document).on('show.bs.modal', '#addPlanModal', () => {
                const planForm = document.getElementById('planForm');
                if (planForm) {
                    planForm.reset();
                    PlansManager.time.setDefault();
                }
            });

            // 统一处理保存计划事件
            $(document).on('click', '#savePlan', async () => {
                try {
                    const userId = document.getElementById('planUserId')?.value;
                    const planTime = document.getElementById('planTime')?.value;
                    const content = document.getElementById('planContent')?.value;

                    if (!userId || !planTime || !content) {
                        alert('请填写完整信息');
                        return;
                    }

                    const data = { userId, planTime, content };
                    await PlansManager.db.add(data);
                    $('#addPlanModal').modal('hide');
                    
                    const planForm = document.getElementById('planForm');
                    if (planForm) {
                        planForm.reset();
                        PlansManager.time.setDefault();
                    }
                    
                    await PlansManager.checkTodoStatus();
                    
                    // 如果在计划管理页面，刷新列表
                    if (document.getElementById('planTableBody')) {
                        await PlansManager.loadPlans();
                    }
                } catch (error) {
                    console.error('添加计划失败：', error);
                    alert('添加计划失败：' + error);
                }
            });

            // 删除计划事件
            $(document).on('click', '.delete-plan', async function(e) {
                const planId = parseInt($(this).data('id'));
                if (confirm('确认删除此计划？')) {
                    try {
                        await PlansManager.db.delete(planId);
                        await PlansManager.loadPlans();
                    } catch (error) {
                        console.error('删除计划失败：', error);
                        alert('删除计划失败：' + error.message);
                    }
                }
            });

            // 清除所有计划事件
            $(document).on('click', '#clearAllPlans', async function(e) {
                if (confirm('确认清除所有计划？此操作不可恢复！')) {
                    try {
                        await PlansManager.db.clear();
                        await PlansManager.loadPlans();
                    } catch (error) {
                        console.error('清除所有计划失败：', error);
                        alert('清除所有计划失败：' + error.message);
                    }
                }
            });

        } catch (error) {
            console.error('初始化计划管理失败：', error);
        }
    },

    // 加载计划列表
    loadPlans: async () => {
        try {
            const plans = await PlansManager.db.getAll();
            plans.sort((a, b) => new Date(b.planTime) - new Date(a.planTime));
            
            const tbody = document.getElementById('planTableBody');
            if (tbody) {
                tbody.innerHTML = plans.map(plan => {
                    const now = TimeZoneManager.getCurrentTime();
                    const timeLeft = new Date(plan.planTime) - now;
                    const isExpired = timeLeft < 0;
                    
                    let status = '进行中';
                    if (isExpired && !plan.status) {
                        status = '未确认';
                    } else if (isExpired && plan.status) {
                        status = '已确认';
                    }
                    
                    return `
                    <tr>
                        <td>${plan.planTime}</td>
                        <td>${plan.userId}</td>
                        <td>${plan.content}</td>
                        <td>${PlansManager.time.getRemaining(plan.planTime)}</td>
                        <td>
                            <span class="badge ${
                                status === '进行中' ? 'badge-primary' : 
                                status === '未确认' ? 'badge-danger' : 
                                'badge-secondary'
                            }">${status}</span>
                            ${isExpired && !plan.status ? 
                                `<button type="button" class="btn btn-sm btn-warning confirm-plan ml-2" data-id="${plan.id}">确认</button>` : 
                                ''
                            }
                        </td>
                        <td>
                            <button type="button" class="btn btn-sm btn-danger delete-plan" data-id="${plan.id}">删除</button>
                        </td>
                    </tr>
                `;
                }).join('');
            }
            await PlansManager.ui.updateNotifications();
        } catch (error) {
            console.error('加载计划列表失败：', error);
            alert('加载计划列表失败：' + error.message);
        }
    },

    // 添加更新定时器的属性
    updateTimer: null
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // 初始化数据库
        await PlansManager.init();
    } catch (error) {
        console.error('初始化失败：', error);
    }
}); 