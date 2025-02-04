// 计划管理模块
const PlansManager = {
    // 数据库操作
    db: {
        // 获取所有计划
        getAll: () => {
            return new Promise((resolve, reject) => {
                if (!db) {
                    reject('数据库未初始化');
                    return;
                }
                const transaction = db.transaction(['plans'], 'readonly');
                const store = transaction.objectStore('plans');
                const request = store.getAll();

                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject('获取计划列表失败');
            });
        },

        // 添加计划
        add: (plan) => {
            return new Promise((resolve, reject) => {
                if (!db) {
                    reject('数据库未初始化');
                    return;
                }
                const transaction = db.transaction(['plans'], 'readwrite');
                const store = transaction.objectStore('plans');
                const request = store.add({
                    ...plan,
                    planTime: plan.planTime,
                    planTZ: TimeZoneManager.currentTimeZone
                });

                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject('添加计划失败');
            });
        },

        // 删除计划
        delete: (id) => {
            return new Promise((resolve, reject) => {
                if (!db) {
                    reject('数据库未初始化');
                    return;
                }
                const transaction = db.transaction(['plans'], 'readwrite');
                const store = transaction.objectStore('plans');
                const request = store.delete(id);

                request.onsuccess = () => resolve();
                request.onerror = () => reject('删除计划失败');
            });
        },

        // 清除所有计划
        clear: () => {
            return new Promise((resolve, reject) => {
                if (!db) {
                    reject('数据库未初始化');
                    return;
                }
                const transaction = db.transaction(['plans'], 'readwrite');
                const store = transaction.objectStore('plans');
                const request = store.clear();

                request.onsuccess = () => resolve();
                request.onerror = () => reject('清除所有计划失败');
            });
        }
    },

    // UI 更新
    updatePlanNotifications: async () => {
        try {
            const plans = await PlansManager.db.getAll();
            const now = TimeZoneManager.getCurrentTime();
            
            // 计算未过期的计划（这里直接把 plan.planTime 当作固定值）
            const activePlans = plans.filter(plan => {
                // 将 plan.planTime 当作字符串解析。由于我们不再转换它的时区，
                // 它会被视为固定本地时间（或用户当初输入的那一刻）。
                // 不管用户后来切换了什么时区，这个字符串都不再变化。
                const planDate = new Date(plan.planTime);
                return planDate > now;
            });
            
            // 更新计划数量
            const planCountElement = document.getElementById('planCount');
            if (planCountElement) {
                planCountElement.textContent = activePlans.length;
            }
            
            // 更新计划列表
            const planList = document.getElementById('planList');
            if (planList) {
                planList.innerHTML = activePlans.map(plan => {
                    const timeRemaining = PlansManager.getTimeRemaining(plan.planTime);
                    return `
                        <a href="#" class="dropdown-item">
                            <div class="text-sm">${plan.userId}</div>
                            <div class="text-sm text-muted">${plan.content}</div>
                            <div class="text-sm text-muted">剩余: ${timeRemaining}</div>
                        </a>
                        <div class="dropdown-divider"></div>
                    `;
                }).join('') || '<div class="dropdown-item">暂无计划</div>';
            }
        } catch (error) {
            console.error('更新计划提醒失败：', error);
        }
    },

    // 加载计划列表
    loadPlans: async () => {
        try {
            const plans = await PlansManager.db.getAll();
            const tbody = document.getElementById('planTableBody');
            if (tbody) {
                tbody.innerHTML = plans.map(plan => `
                    <tr>
                        <td>${plan.planTime}</td>
                        <td>${plan.userId}</td>
                        <td>${plan.content}</td>
                        <td>${PlansManager.getTimeRemaining(plan.planTime)}</td>
                        <td>
                            <button class="btn btn-sm btn-danger delete-plan" data-id="${plan.id}">
                                删除
                            </button>
                        </td>
                    </tr>
                `).join('');
            }
            await PlansManager.updatePlanNotifications();
        } catch (error) {
            console.error('加载计划列表失败：', error);
            alert('加载计划列表失败：' + error.message);
        }
    },

    // 获取剩余时间
    getTimeRemaining: (planTime) => {
        const now = TimeZoneManager.getCurrentTime();
        const planDate = new Date(planTime);
        const diff = planDate - now;
        
        // 如果计划已过期但还没有确认
        if (diff < 0) {
            const planKey = `plan_expired_${planTime}`;
            if (!localStorage.getItem(planKey)) {
                // 显示确认弹窗
                if (confirm('该计划已到期，是否确认？')) {
                    localStorage.setItem(planKey, 'confirmed');
                    return '已过期';
                } else {
                    // 如果用户没有确认，显示即将过期
                    return '即将过期';
                }
            }
            return '已过期';
        }
        
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        if (days > 0) {
            return `${days}天${hours}小时后到期`;
        } else if (hours > 0) {
            return `${hours}小时${minutes}分钟后到期`;
        } else {
            return `${minutes}分钟后到期`;
        }
    },

    // 设置默认时间（仍可保留，用于打开模态框时默认给个当前本地时间）
    setDefaultTime: () => {
        const now = TimeZoneManager.getCurrentTime();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        
        const planTimeInput = document.getElementById('planTime');
        if (planTimeInput) {
            planTimeInput.value = `${year}-${month}-${day}T${hours}:${minutes}`;
        }
    },

    // 删除计划事件
    handleDelete: async (id) => {
        if (confirm('确认删除此计划？')) {
            try {
                await PlansManager.db.delete(id);
                await PlansManager.loadPlans();
            } catch (error) {
                console.error('删除计划失败：', error);
                alert('删除计划失败：' + error.message);
            }
        }
    },

    // 清除所有计划
    handleClearAll: async () => {
        if (confirm('确认清除所有计划？此操作不可恢复！')) {
            try {
                await PlansManager.db.clear();
                await PlansManager.loadPlans();
            } catch (error) {
                console.error('清除所有计划失败：', error);
                alert('清除所有计划失败：' + error.message);
            }
        }
    },

    // 请求通知权限
    requestNotificationPermission: async () => {
        if (!("Notification" in window)) {
            console.log("当前浏览器不支持系统通知");
            return false;
        }
        
        if (Notification.permission === "granted") {
            return true;
        }
        
        if (Notification.permission !== "denied") {
            const permission = await Notification.requestPermission();
            return permission === "granted";
        }
        
        return false;
    },

    // 显示系统通知
    showNotification: (plan, isExpiring = false) => {
        if (Notification.permission === "granted") {
            let title = isExpiring ? "计划即将到期提醒" : "计划已过期提醒";
            let content = `用户：${plan.userId}\n计划内容：${plan.content}`;
            
            // 如果是即将过期的通知，添加剩余时间
            if (isExpiring) {
                const timeLeft = new Date(plan.planTime) - TimeZoneManager.getCurrentTime();
                const minutes = Math.floor(timeLeft / 60000);
                content += `\n剩余时间：${minutes}分钟`;
            }

            const notification = new Notification(title, {
                body: content,
                icon: "favicon.ico",
                requireInteraction: false,
                silent: false
            });
        }
    },

    // 检查代办状态
    checkTodoStatus: async () => {
        try {
            const plans = await PlansManager.db.getAll();
            if (!plans) {
                PlansManager.updateTodoCard([]);
                return;
            }

            const now = TimeZoneManager.getCurrentTime();
            
            // 检查是否有新过期的计划需要通知
            plans.forEach(plan => {
                const planDate = new Date(plan.planTime);
                const diff = planDate - now;
                const planKey = `plan_expired_${plan.planTime}`;
                const notifiedKey = `plan_notified_${plan.planTime}`;

                // 如果在10分钟内即将过期且未发送过通知
                if (diff > 0 && diff <= 10 * 60 * 1000 && !localStorage.getItem(notifiedKey)) {
                    PlansManager.showNotification(plan, true);
                    localStorage.setItem(notifiedKey, 'true');
                }
                
                // 如果已过期且未发送过过期通知
                if (diff < 0 && !localStorage.getItem(planKey)) {
                    PlansManager.showNotification(plan, false);
                }
            });

            // 原有的排序和过滤逻辑保持不变
            const sortedPlans = plans.sort((a, b) => {
                const aDate = new Date(a.planTime);
                const bDate = new Date(b.planTime);
                return aDate - bDate;
            });

            const validPlans = sortedPlans.filter(plan => {
                const planDate = new Date(plan.planTime);
                const diff = planDate - now;
                if (diff < 0) {
                    const planKey = `plan_expired_${plan.planTime}`;
                    return !localStorage.getItem(planKey);
                }
                return true;
            });
            
            PlansManager.updateNotification(validPlans);
            PlansManager.updateTodoCard(validPlans);
            
        } catch (error) {
            console.error('检查代办计划状态失败：', error);
            PlansManager.handleError();
        }
    },

    // 更新铃铛通知
    updateNotification: (validPlans) => {
        const planCount = document.getElementById('planCount');
        const planList = document.getElementById('planList');
        
        if (planCount) {
            planCount.textContent = validPlans.length.toString();
        }
        
        if (planList) {
            planList.innerHTML = ''; // 清空现有内容
            
            if (validPlans.length === 0) {
                planList.innerHTML = '<a class="dropdown-item">暂无代办计划</a>';
                return;
            }

            // 只显示前5个计划
            validPlans.slice(0, 5).forEach(plan => {
                const deadline = new Date(plan.planTime);
                const timeLeft = deadline - TimeZoneManager.getCurrentTime();
                
                let timeLeftText = PlansManager.getTimeRemaining(plan.planTime);
                
                const item = document.createElement('a');
                item.className = 'dropdown-item';
                item.innerHTML = `
                    <div class="text-sm mb-0">
                        <strong>${plan.userId}</strong>
                        <span class="float-right text-muted text-sm">${timeLeftText}</span>
                    </div>
                    <p class="text-sm mb-0">${plan.content}</p>
                `;
                planList.appendChild(item);
                
                if (planList.children.length < validPlans.length) {
                    const divider = document.createElement('div');
                    divider.className = 'dropdown-divider';
                    planList.appendChild(divider);
                }
            });
        }
    },

    // 更新代办卡片
    updateTodoCard: (plans) => {
        const todoCard = document.getElementById('todoCard');
        const todoCount = document.getElementById('todoCount');
        const todoUser = document.getElementById('todoUser');
        const todoContent = document.getElementById('todoContent');
        const todoTimeLeft = document.getElementById('todoTimeLeft');

        // 无计划情况
        if (!plans || plans.length === 0) {
            if (todoCount) todoCount.textContent = '0';
            if (todoUser) todoUser.textContent = '';
            if (todoContent) todoContent.textContent = '暂无代办计划';
            if (todoTimeLeft) todoTimeLeft.textContent = '';
            if (todoCard) {
                todoCard.classList.remove('bg-warning', 'bg-danger', 'bg-info');
                todoCard.classList.add('bg-success');
            }
            return;
        }

        const now = TimeZoneManager.getCurrentTime();
        
        // 检查计划状态并发送通知
        plans.forEach(plan => {
            const planDate = new Date(plan.planTime);
            const diff = planDate - now;
            const planKey = `plan_expired_${plan.planTime}`;
            const notifiedKey = `plan_notified_${plan.planTime}`;

            // 如果在10分钟内即将过期且未发送过通知
            if (diff > 0 && diff <= 10 * 60 * 1000 && !localStorage.getItem(notifiedKey)) {
                PlansManager.showNotification(plan, true);
                localStorage.setItem(notifiedKey, 'true');
            }
            
            // 如果已过期且未发送过过期通知
            if (diff < 0 && !localStorage.getItem(planKey)) {
                PlansManager.showNotification(plan, false);
            }
        });

        // 获取最近的计划
        const nearestPlan = plans[0];
        const planDate = new Date(nearestPlan.planTime);
        const timeLeft = planDate - now;
        const planKey = `plan_expired_${nearestPlan.planTime}`;

        // 更新显示内容
        if (todoCount) todoCount.textContent = plans.length.toString();
        if (todoUser) todoUser.textContent = nearestPlan.userId;
        if (todoContent) todoContent.textContent = nearestPlan.content;

        // 更新时间显示和确认按钮
        if (todoTimeLeft) {
            if (timeLeft < 0) {
                todoTimeLeft.innerHTML = '<button class="btn btn-sm btn-light" onclick="PlansManager.confirmExpired(\'' + nearestPlan.planTime + '\')">确认过期</button>';
            } else {
                todoTimeLeft.textContent = PlansManager.getTimeRemaining(nearestPlan.planTime);
            }
        }

        // 更新卡片颜色
        if (todoCard) {
            todoCard.classList.remove('bg-success', 'bg-warning', 'bg-danger', 'bg-info');
            let cardClass = 'bg-info'; // 默认蓝色

            if (timeLeft < 0 && !localStorage.getItem(planKey)) {
                cardClass = 'bg-danger'; // 过期未确认显示红色
            } else if (timeLeft > 0 && timeLeft <= 10 * 60 * 1000) {
                cardClass = 'bg-warning'; // 10分钟内显示黄色
            } else if (timeLeft < 0 && localStorage.getItem(planKey)) {
                cardClass = 'bg-success'; // 已确认过期显示绿色
            }

            todoCard.classList.add(cardClass);
        }
    },

    // 确认过期
    confirmExpired: (planTime) => {
        const planKey = `plan_expired_${planTime}`;
        localStorage.setItem(planKey, 'confirmed');
        PlansManager.checkTodoStatus(); // 更新显示
    },

    // 错误处理
    handleError: () => {
        const elements = {
            todoCount: document.getElementById('todoCount'),
            todoUser: document.getElementById('todoUser'),
            todoContent: document.getElementById('todoContent'),
            todoTimeLeft: document.getElementById('todoTimeLeft'),
            todoCard: document.getElementById('todoCard'),
            planCount: document.getElementById('planCount')
        };

        if (elements.todoCount) elements.todoCount.textContent = '0';
        if (elements.todoUser) elements.todoUser.textContent = '';
        if (elements.todoContent) elements.todoContent.textContent = '加载失败';
        if (elements.todoTimeLeft) elements.todoTimeLeft.textContent = '';
        if (elements.planCount) elements.planCount.textContent = '0';
        if (elements.todoCard) {
            elements.todoCard.classList.remove('bg-success', 'bg-warning');
            elements.todoCard.classList.add('bg-danger');
        }
    },

    // 初始化
    init: async () => {
        try {
            // 请求通知权限
            await PlansManager.requestNotificationPermission();
            
            // 等待 main.js 的 initDB 完成
            if (!db) {
                await initDB();
            }

            // 打开模态框时，重置表单并设置默认时间
            $('#addPlanModal').on('show.bs.modal', () => {
                document.getElementById('planForm').reset();
                PlansManager.setDefaultTime();
            });

            // 绑定保存计划按钮
            const savePlanBtn = document.getElementById('savePlan');
            if (savePlanBtn) {
                savePlanBtn.addEventListener('click', async () => {
                    try {
                        const data = {
                            userId: document.getElementById('planUserId').value,
                            planTime: document.getElementById('planTime').value,
                            content: document.getElementById('planContent').value
                        };

                        if (!data.userId || !data.planTime || !data.content) {
                            alert('请填写完整信息');
                            return;
                        }

                        await PlansManager.db.add(data);
                        $('#addPlanModal').modal('hide');
                        document.getElementById('planForm').reset();

                        // 立即更新数据
                        await PlansManager.checkTodoStatus();
                        
                        // 如果在计划管理页面，也更新表格
                        if (document.getElementById('planTableBody')) {
                            await PlansManager.loadPlans();
                        }
                    } catch (error) {
                        alert('添加计划失败：' + error);
                        console.error(error);
                    }
                });
            }

            // 绑定删除事件
            document.addEventListener('click', async (e) => {
                if (e.target.classList.contains('delete-plan')) {
                    const planId = parseInt(e.target.dataset.id);
                    await PlansManager.handleDelete(planId);
                }
            });

            // 绑定清除所有计划事件
            const clearAllBtn = document.getElementById('clearAllPlans');
            if (clearAllBtn) {
                clearAllBtn.addEventListener('click', PlansManager.handleClearAll);
            }

            // 定时更新计划提醒
            setInterval(PlansManager.updatePlanNotifications, 60000);

            // 监听时区变更事件 （用户切换时区后，如果此页面有 #planTableBody，就重新 load，否则只更新提醒）
            window.addEventListener('timeZoneChanged', async () => {
                if (document.getElementById('planTableBody')) {
                    await PlansManager.loadPlans();
                } else {
                    await PlansManager.updatePlanNotifications();
                }
            });

            // 初始化页面数据
            if (document.getElementById('planTableBody')) {
                await PlansManager.loadPlans();
            } else {
                await PlansManager.updatePlanNotifications();
            }

            // 初始化时也设置一次默认时间（避免第一次打开时没有初始值）
            PlansManager.setDefaultTime();

            // 初始检查代办状态
            await PlansManager.checkTodoStatus();

            // 每分钟更新一次代办状态
            setInterval(PlansManager.checkTodoStatus, 60000);

            // 监听时区变更事件时也要更新代办状态
            window.addEventListener('timeZoneChanged', PlansManager.checkTodoStatus);
        } catch (error) {
            console.error('初始化计划管理失败：', error);
        }
    }
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', PlansManager.init); 