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

        // 请求通知权限
        request: async () => {
            if (!("Notification" in window)) return false;
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
            if (Notification.permission === "granted") {
                try {
                    const title = type === 'expired' ? 
                        "你有未确认的计划" : 
                        "你有即将到期的计划";
                    
                    const content = `用户：${plan.userId}\n计划内容：${plan.content}`;

                    // 确保关闭之前的通知
                    if (PlansManager.notification.currentNotification) {
                        PlansManager.notification.currentNotification.close();
                    }

                    // 创建新通知
                    const notification = new Notification(title, {
                        body: content,
                        icon: "favicon.ico",
                        requireInteraction: false,
                        silent: false,
                        tag: `plan_${plan.id}` // 添加标签以识别通知
                    });

                    // 存储当前通知
                    PlansManager.notification.currentNotification = notification;
                } catch (error) {
                    console.warn('显示通知失败:', error);
                }
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
                if (localStorage.getItem(`plan_expired_${plan.id}`)) {
                    PlansManager.notification.clearNotificationTimer(plan.id);
                } else {
                    // 重新创建通知对象
                    PlansManager.notification.show(plan, 'expired');
                }
            }, 120000);

            // 存储定时器ID
            PlansManager.notification.notificationTimers.set(plan.id, timerId);
        },

        // 清除特定计划的通知定时器
        clearNotificationTimer: (planId) => {
            if (PlansManager.notification.notificationTimers.has(planId)) {
                clearInterval(PlansManager.notification.notificationTimers.get(planId));
                PlansManager.notification.notificationTimers.delete(planId);
            }
        },

        // 清除所有通知定时器
        clearAllTimers: () => {
            PlansManager.notification.notificationTimers.forEach(timerId => {
                clearInterval(timerId);
            });
            PlansManager.notification.notificationTimers.clear();
        },

        // 添加当前通知的引用
        currentNotification: null
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

            // 没有计划时显示绿色
            if (!plans?.length) {
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
            
            // 检查是否有待确认的计划
            const hasUnconfirmed = plans.some(plan => {
                const timeLeft = new Date(plan.planTime) - now;
                return timeLeft < 0 && !localStorage.getItem(`plan_expired_${plan.id}`);
            });

            // 检查是否只有已取消的计划
            const allCancelled = plans.every(plan => {
                const timeLeft = new Date(plan.planTime) - now;
                return timeLeft < 0 && localStorage.getItem(`plan_expired_${plan.id}`);
            });

            // 检查是否有10分钟内到期的计划
            const hasNearExpiry = !hasUnconfirmed && plans.some(plan => {
                const timeLeft = new Date(plan.planTime) - now;
                return timeLeft > 0 && timeLeft <= 600000;
            });

            // 获取最近的未取消计划
            const activePlans = plans.filter(plan => {
                const timeLeft = new Date(plan.planTime) - now;
                return timeLeft > 0 || !localStorage.getItem(`plan_expired_${plan.id}`);
            });
            
            const nearestPlan = activePlans[0] || plans[0];
            const timeLeft = new Date(nearestPlan.planTime) - now;
            const isExpired = timeLeft < 0;
            const isConfirmed = localStorage.getItem(`plan_expired_${nearestPlan.id}`);

            // 更新UI
            if (elements.count) elements.count.textContent = plans.length.toString();
            if (elements.user) elements.user.textContent = nearestPlan.userId;
            if (elements.content) elements.content.textContent = nearestPlan.content;
            if (elements.timeLeft) {
                elements.timeLeft.innerHTML = `
                    ${hasUnconfirmed ? 
                        `<button class="btn btn-sm btn-light" onclick="PlansManager.confirmExpired(${nearestPlan.id})">
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
                
                if (hasUnconfirmed) {
                    // 有待确认计划显示红色
                    elements.card.classList.add('bg-danger');
                } else if (hasNearExpiry) {
                    // 有10分钟内到期的计划显示黄色
                    elements.card.classList.add('bg-warning');
                } else if (!allCancelled && activePlans.length > 0) {
                    // 只有超过10分钟的计划显示蓝色
                    elements.card.classList.add('bg-info');
                } else {
                    // 其他情况显示绿色（全部已取消或没有计划）
                    elements.card.classList.add('bg-success');
                }
            }
        }
    },

    // 检查计划状态并发送通知
    checkTodoStatus: async () => {
        try {
            const plans = await PlansManager.db.getAll();
            if (!plans?.length) return;

            const now = TimeZoneManager.getCurrentTime();
            
            plans.forEach(plan => {
                const timeLeft = new Date(plan.planTime) - now;
                const isExpired = timeLeft < 0;
                const isConfirmed = localStorage.getItem(`plan_expired_${plan.id}`);
                
                // 如果计划已过期且未确认，开始重复通知
                if (isExpired && !isConfirmed) {
                    PlansManager.notification.startRepeatingNotification(plan);
                }
                // 如果计划在10分钟内到期且未发送过通知，发送一次通知
                else if (timeLeft > 0 && timeLeft <= 600000 && 
                         !localStorage.getItem(`notified_10min_${plan.id}`)) {
                    PlansManager.notification.show(plan, 'upcoming');
                    localStorage.setItem(`notified_10min_${plan.id}`, 'true');
                }
            });

            await PlansManager.ui.updateTodoCard(plans);
            
        } catch (error) {
            console.error('检查计划状态失败：', error);
        }
    },

    // 初始化
    init: async () => {
        try {
            // 确保数据库初始化
            if (!db) {
                await new Promise((resolve) => {
                    const request = indexedDB.open('financeDB', 1);
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

            // 添加确认按钮事件处理（直接确认，不显示提示）
            $(document).on('click', '.confirm-plan', async function() {
                const planId = parseInt($(this).data('id'));
                await PlansManager.confirmExpired(planId);
            });

        } catch (error) {
            console.error('初始化计划管理失败：', error);
        }
    },

    // 加载计划列表
    loadPlans: async () => {
        try {
            const plans = await PlansManager.db.getAll();
            // 按计划时间倒序排序
            plans.sort((a, b) => new Date(b.planTime) - new Date(a.planTime));
            
            const tbody = document.getElementById('planTableBody');
            if (tbody) {
                tbody.innerHTML = plans.map(plan => {
                    const now = TimeZoneManager.getCurrentTime();
                    const timeLeft = new Date(plan.planTime) - now;
                    const isExpired = timeLeft < 0;
                    const isConfirmed = localStorage.getItem(`plan_expired_${plan.id}`);
                    
                    let status = '进行中';
                    if (isExpired && !isConfirmed) {
                        status = '未确认';
                    } else if (isExpired && isConfirmed) {
                        status = '已取消';
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
                            ${isExpired && !isConfirmed ? 
                                `<button class="btn btn-sm btn-warning confirm-plan ml-2" data-id="${plan.id}">确认</button>` : 
                                ''
                            }
                        </td>
                        <td>
                            <button class="btn btn-sm btn-danger delete-plan" data-id="${plan.id}">删除</button>
                        </td>
                    </tr>
                `}).join('');
            }
            await PlansManager.ui.updateNotifications();
        } catch (error) {
            console.error('加载计划列表失败：', error);
            alert('加载计划列表失败：' + error.message);
        }
    },

    // 确认过期方法
    confirmExpired: async (planId) => {
        try {
            // 直接确认，不显示提示框
            localStorage.setItem(`plan_expired_${planId}`, 'true');
            // 清除该计划的通知定时器
            PlansManager.notification.clearNotificationTimer(planId);
            // 刷新数据
            await PlansManager.loadPlans();
            await PlansManager.checkTodoStatus();
        } catch (error) {
            console.error('确认过期失败：', error);
            alert('确认过期失败：' + error.message);
        }
    },

    // 添加更新定时器的属性
    updateTimer: null
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', PlansManager.init); 