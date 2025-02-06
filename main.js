// 数据库初始化
let db;
const DB_NAME = 'FinanceDB';
const DB_VERSION = 3;  // 修改为当前版本号

// 获取系统时区，但默认使用 'local'
const systemTZ = 'local';  // 改为直接使用 'local'
let currentTimeZone = localStorage.getItem('timeZone') || systemTZ;

const initDB = () => {
    return new Promise((resolve, reject) => {
        console.log('Initializing database...');
        const request = indexedDB.open('FinancialDashboard', DB_VERSION);
        
        request.onerror = (event) => {
            console.error('数据库打开失败：', event.target.error);
            reject(event.target.error);
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            console.log('数据库连接成功');
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const upgradeDB = event.target.result;
            
            // 创建订单表
            if (!upgradeDB.objectStoreNames.contains('orders')) {
                const orderStore = upgradeDB.createObjectStore('orders', { keyPath: 'id', autoIncrement: true });
                orderStore.createIndex('userId', 'userId', { unique: false });
                orderStore.createIndex('submitTime', 'submitTime', { unique: false });
                orderStore.createIndex('orderDate', 'orderDate', { unique: false });
            }
            
            // 创建用户表
            if (!upgradeDB.objectStoreNames.contains('users')) {
                const userStore = upgradeDB.createObjectStore('users', { keyPath: 'userId' });
                userStore.createIndex('registerTime', 'registerTime', { unique: false });
                userStore.createIndex('avatar', 'avatar', { unique: false });
                userStore.createIndex('noteInputSize', 'noteInputSize', { unique: false });
            }

            // 创建 plans 表
            if (!upgradeDB.objectStoreNames.contains('plans')) {
                const planStore = upgradeDB.createObjectStore('plans', {
                    keyPath: 'id',
                    autoIncrement: true
                });
                planStore.createIndex('userId', 'userId', { unique: false });
                planStore.createIndex('planTime', 'planTime', { unique: false });
                planStore.createIndex('status', 'status', { unique: false });
            }

            // 添加 pinnedUsers store (新增)
            if (!upgradeDB.objectStoreNames.contains('pinnedUsers')) {
                upgradeDB.createObjectStore('pinnedUsers', { keyPath: 'id' });
            }

            console.log('数据库升级成功，版本号:', DB_VERSION);
        };
    });
};

// 时区时间管理模块
const TimeZoneManager = {
    // 注意，这里也改为直接用 currentTimeZone 这个变量
    get currentTimeZone() {
        return currentTimeZone;
    },
    setTimeZone(timeZone) {
        currentTimeZone = timeZone;
        this.updateTime();
    },

    // 获取当前时区的时间
    getCurrentTime() {
        const now = new Date();
        if (currentTimeZone === 'local') {
            return now;
        }
        return new Date(now.toLocaleString('en-US', { timeZone: currentTimeZone }));
    },

    // 转换时间到当前时区
    convertTime(date) {
        if (!date) return null;
        const d = new Date(date);
        if (currentTimeZone === 'local') {
            return d;
        }
        return new Date(d.toLocaleString('en-US', { timeZone: currentTimeZone }));
    },

    // 格式化日期
    formatDate(date) {
        const zonedDate = this.convertTime(date);
        if (!zonedDate) return '';
        
        const year = zonedDate.getFullYear();
        const month = String(zonedDate.getMonth() + 1).padStart(2, '0');
        const day = String(zonedDate.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    // 更新时间显示
    updateTime() {
        const timeElement = document.getElementById('currentTime');
        if (timeElement) {
            timeElement.textContent = this.getCurrentTime().toLocaleString('zh-CN');
        }
        // 触发时区变更事件
        document.dispatchEvent(new CustomEvent('timeZoneChanged'));
    }
};

// 初始化时间更新
function startTimeUpdate() {
    // 立即更新一次
    TimeZoneManager.updateTime();
    // 每秒更新一次
    setInterval(() => {
        TimeZoneManager.updateTime();
    }, 1000);
}

// 在文档加载完成后启动时间更新
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // 启动时间更新
        startTimeUpdate();
        
        // 如果在设置页面，绑定时区选择事件
        const timeZoneSelect = document.getElementById('timeZone');
        if (timeZoneSelect) {
            // 如果 localStorage 中没有存储的时区，就默认选择 'local'
            if (!localStorage.getItem('timeZone')) {
                timeZoneSelect.value = 'local';
                localStorage.setItem('timeZone', 'local');
            } else {
                timeZoneSelect.value = currentTimeZone;
            }
            
            timeZoneSelect.addEventListener('change', (e) => {
                const newTZ = e.target.value;
                localStorage.setItem('timeZone', newTZ);
                TimeZoneManager.setTimeZone(newTZ);
            });
        }

        // 绑定恢复出厂设置按钮事件
        const resetEverythingBtn = document.getElementById('resetEverything');
        if (resetEverythingBtn) {
            resetEverythingBtn.addEventListener('click', async () => {
                if (confirm('确认恢复出厂设置？这将清空所有数据并刷新页面。')) {
                    try {
                        await resetEverything();
                        alert('已清空所有数据，并恢复默认设置。');
                        // 刷新页面
                        location.reload();
                    } catch (error) {
                        alert('重置失败：' + error.message);
                    }
                }
            });
        }

        // 如果需要页面加载时立刻初始化数据库
        console.log('Initializing database...');
        await initDB();
        console.log('Database initialized successfully');

        // 绑定"导出数据"按钮事件
        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', async () => {
                try {
                    const data = await exportAllData();
                    const jsonStr = JSON.stringify(data, null, 2);
                    
                    // 生成当前时间戳，用于文件名
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                    
                    // 下载为 JSON 文件
                    const blob = new Blob([jsonStr], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `finance_data_${timestamp}.json`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    
                    alert('数据导出成功！');
                } catch (error) {
                    alert('导出失败：' + error);
                    console.error('导出失败：', error);
                }
            });
        }

        // 绑定"导入数据"按钮事件
        const importFile = document.getElementById('importFile');
        if (importFile) {
            importFile.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                
                const reader = new FileReader();
                reader.onload = async (evt) => {
                    try {
                        const jsonData = JSON.parse(evt.target.result);
                        await importAllData(jsonData);
                        alert('数据导入成功！');
                        location.reload(); // 刷新页面以显示新数据
                    } catch (err) {
                        alert('导入失败：' + err.message);
                        console.error('导入失败：', err);
                    }
                };
                reader.readAsText(file);
            });
        }
    } catch (error) {
        console.error('Initialization error:', error);
    }
});

// 为了向后兼容，提供全局函数
window.formatDate = (date) => TimeZoneManager.formatDate(date);
window.getCurrentZonedTime = () => TimeZoneManager.getCurrentTime();
window.convertToSelectedTimeZone = (date) => TimeZoneManager.convertTime(date);

// 导出时间管理模块
window.TimeZoneManager = TimeZoneManager;

// 添加用户（如果不存在）
const addUserIfNotExists = async (userId) => {
    return new Promise((resolve, reject) => {
        try {
            const transaction = db.transaction(['users'], 'readwrite');
            const store = transaction.objectStore('users');
            
            const request = store.get(userId);
            
            request.onsuccess = (event) => {
                const user = event.target.result;
                if (!user) {
                    // 如果用户不存在，创建新用户，但不设置注册时间
                    const newUser = {
                        userId: userId,
                        registerTime: '', // 初始为空
                        totalDeposit: '0.00',
                        totalWithdrawal: '0.00'
                    };
                    
                    const addRequest = store.add(newUser);
                    addRequest.onsuccess = () => resolve(newUser);
                    addRequest.onerror = () => reject(new Error('添加用户失败'));
                } else {
                    resolve(user);
                }
            };
            
            request.onerror = () => {
                reject(new Error('查询用户失败'));
            };
        } catch (error) {
            reject(error);
        }
    });
};

// 修改添加订单函数
const addOrder = async (data) => {
    return new Promise(async (resolve, reject) => {
        try {
            // 先确保用户存在
            await addUserIfNotExists(data.userId);

            const transaction = db.transaction(['orders', 'users'], 'readwrite');
            const orderStore = transaction.objectStore('orders');
            const userStore = transaction.objectStore('users');

            // 获取用户信息
            const userRequest = userStore.get(data.userId);
            userRequest.onsuccess = async (event) => {
                const user = event.target.result;
                
                // 如果用户的注册时间为空，则直接使用订单日期
                if (!user.registerTime) {
                    user.registerTime = data.orderDate; // 直接使用订单日期
                }

                // 处理备注（如果有）
                const orderNote = document.getElementById('orderNote')?.value.trim();
                if (orderNote) {
                    const currentDate = new Date().toLocaleDateString();
                    user.note = `${currentDate}: ${orderNote}\n${user.note || ''}`;
                }

                // 添加订单
                const orderData = {
                    ...data,
                    submitTime: data.submitTime,
                    orderDate: data.orderDate,
                    amount: parseFloat(data.amount)
                };

                const request = orderStore.add(orderData);

                request.onsuccess = () => {
                    // 更新用户统计数据
                    if (data.type === 'deposit') {
                        user.totalDeposit = (parseFloat(user.totalDeposit || 0) + parseFloat(data.amount)).toFixed(2);
                    } else {
                        user.totalWithdrawal = (parseFloat(user.totalWithdrawal || 0) + parseFloat(data.amount)).toFixed(2);
                    }
                    
                    // 更新用户数据（包括备注）
                    const putRequest = userStore.put(user);
                    putRequest.onsuccess = () => resolve();
                    putRequest.onerror = () => reject(new Error('更新用户数据失败'));
                };

                request.onerror = () => {
                    reject(new Error('添加订单失败'));
                };
            };

        } catch (error) {
            reject(error);
        }
    });
};

// 获取所有订单
const getOrders = async () => {
    return new Promise((resolve, reject) => {
        try {
            const transaction = db.transaction(['orders'], 'readonly');
            const store = transaction.objectStore('orders');
            const request = store.getAll();

            request.onsuccess = () => {
                const orders = request.result;
                resolve(orders);
            };

            request.onerror = () => {
                reject(new Error('获取订单失败'));
            };
        } catch (error) {
            reject(error);
        }
    });
};

// 删除订单
const deleteOrder = async (orderId) => {
    return new Promise((resolve, reject) => {
        try {
            const transaction = db.transaction(['orders', 'users'], 'readwrite');
            const orderStore = transaction.objectStore('orders');
            const userStore = transaction.objectStore('users');

            const getOrderRequest = orderStore.get(orderId);
            
            getOrderRequest.onsuccess = () => {
                const order = getOrderRequest.result;
                if (!order) {
                    reject(new Error('订单不存在'));
                    return;
                }

                const getUserRequest = userStore.get(order.userId);
                getUserRequest.onsuccess = () => {
                    const user = getUserRequest.result;
                    if (user) {
                        if (order.type === 'deposit') {
                            user.totalDeposit = Math.max(0, user.totalDeposit - order.amount);
                        } else {
                            user.totalWithdrawal = Math.max(0, user.totalWithdrawal - order.amount);
                        }
                        userStore.put(user);
                    }
                    orderStore.delete(orderId);
                };
            };

            transaction.oncomplete = () => {
                console.log('Delete transaction completed');
                resolve();
            };
            
            transaction.onerror = () => {
                console.error('Delete transaction error:', transaction.error);
                reject(transaction.error);
            };
        } catch (error) {
            console.error('Error in deleteOrder:', error);
            reject(error);
        }
    });
};

// 删除用户
const deleteUser = async (userId) => {
    return new Promise((resolve, reject) => {
        try {
            const transaction = db.transaction(['orders', 'users'], 'readwrite');
            const orderStore = transaction.objectStore('orders');
            const userStore = transaction.objectStore('users');

            // 删除用户的所有订单
            const index = orderStore.index('userId');
            const getOrdersRequest = index.getAll(userId);
            
            getOrdersRequest.onsuccess = () => {
                const orders = getOrdersRequest.result;
                orders.forEach(order => {
                    orderStore.delete(order.id);
                });
                userStore.delete(userId);
            };

            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        } catch (error) {
            reject(error);
        }
    });
};

// 获取月度数据
const getMonthlyData = async (date) => {
    return new Promise((resolve, reject) => {
        try {
            const startDate = new Date(date.getFullYear(), date.getMonth(), 1);
            const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);
            
            const transaction = db.transaction(['orders'], 'readonly');
            const orderStore = transaction.objectStore('orders');
            const index = orderStore.index('orderDate');
            
            const request = index.getAll(IDBKeyRange.bound(
                startDate.toISOString(),
                endDate.toISOString()
            ));

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        } catch (error) {
            reject(error);
        }
    });
};

// 获取所有用户
const getAllUsers = async () => {
    return new Promise((resolve, reject) => {
        try {
            const transaction = db.transaction(['users'], 'readonly');
            const userStore = transaction.objectStore('users');
            const request = userStore.getAll();

            request.onsuccess = () => {
                console.log('Retrieved users:', request.result);
                resolve(request.result);
            };
            request.onerror = () => reject(request.error);
        } catch (error) {
            console.error('Error in getAllUsers:', error);
            reject(error);
        }
    });
};

// 获取所有订单
const getAllOrders = async () => {
    return new Promise((resolve, reject) => {
        try {
            const transaction = db.transaction(['orders'], 'readonly');
            const orderStore = transaction.objectStore('orders');
            const request = orderStore.getAll();

            request.onsuccess = () => {
                console.log('Retrieved orders:', request.result);
                resolve(request.result);
            };
            request.onerror = () => reject(request.error);
        } catch (error) {
            console.error('Error in getAllOrders:', error);
            reject(error);
        }
    });
};

// 更新用户备注
const updateUserNote = async (userId, note) => {
    return new Promise((resolve, reject) => {
        try {
            const transaction = db.transaction(['users'], 'readwrite');
            const userStore = transaction.objectStore('users');

            const getUserRequest = userStore.get(userId);
            getUserRequest.onsuccess = () => {
                const user = getUserRequest.result;
                if (user) {
                    user.note = note;
                    userStore.put(user);
                }
            };

            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        } catch (error) {
            reject(error);
        }
    });
};

// 更新用户备注框大小
const updateUserNoteInputSize = async (userId, size) => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['users'], 'readwrite');
        const store = transaction.objectStore('users');
        
        const request = store.get(userId);
        request.onsuccess = () => {
            const user = request.result || {
                userId,
                totalDeposit: 0,
                totalWithdrawal: 0,
                registerTime: new Date().toISOString()
            };
            
            user.noteInputSize = size;
            
            const putRequest = store.put(user);
            putRequest.onsuccess = () => resolve();
            putRequest.onerror = () => reject(putRequest.error);
        };
        
        request.onerror = () => reject(request.error);
    });
};

// ========== 导出所有数据函数 ==========
async function exportAllData() {
    return new Promise(async (resolve, reject) => {
        try {
            if (!db) {
                reject('数据库未初始化');
                return;
            }

            const data = {
                orders: [],
                users: [],
                plans: []
            };

            const transaction = db.transaction(['orders', 'users', 'plans'], 'readonly');
            const ordersStore = transaction.objectStore('orders');
            const usersStore = transaction.objectStore('users');
            const plansStore = transaction.objectStore('plans');

            let counter = 3;

            const checkDone = () => {
                counter--;
                if (counter === 0) resolve(data);
            };

            const ordersReq = ordersStore.getAll();
            ordersReq.onsuccess = () => {
                data.orders = ordersReq.result;
                checkDone();
            };
            ordersReq.onerror = () => reject(ordersReq.error);

            const usersReq = usersStore.getAll();
            usersReq.onsuccess = () => {
                data.users = usersReq.result;
                checkDone();
            };
            usersReq.onerror = () => reject(usersReq.error);

            const plansReq = plansStore.getAll();
            plansReq.onsuccess = () => {
                data.plans = plansReq.result;
                checkDone();
            };
            plansReq.onerror = () => reject(plansReq.error);

        } catch (error) {
            reject(error);
        }
    });
}

// ========== 导入数据函数 ==========
// 注意：这里示例逻辑是先 clear() 再批量 put()。根据实际需求也可只 append。
async function importAllData(jsonData) {
    return new Promise((resolve, reject) => {
        try {
            if (!jsonData) {
                reject(new Error('导入数据为空'));
                return;
            }

            const transaction = db.transaction(['orders', 'users', 'plans'], 'readwrite');
            const ordersStore = transaction.objectStore('orders');
            const usersStore = transaction.objectStore('users');
            const plansStore = transaction.objectStore('plans');

            // 先清空
            ordersStore.clear();
            usersStore.clear();
            plansStore.clear();

            // 再逐条插入
            (jsonData.orders || []).forEach(item => ordersStore.put(item));
            (jsonData.users || []).forEach(item => usersStore.put(item));
            (jsonData.plans || []).forEach(item => plansStore.put(item));

            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);

        } catch (error) {
            reject(error);
        }
    });
}

// ========== 恢复出厂设置（清空 IndexedDB + localStorage） ==========
async function resetEverything() {
    try {
        // 1. 先关闭现有的数据库连接
        if (db) {
            db.close();
        }

        // 2. 删除所有 localStorage 数据
        localStorage.clear();

        // 3. 删除 IndexedDB 数据库
        await new Promise((resolve, reject) => {
            const deleteRequest = indexedDB.deleteDatabase('FinancialDashboard');
            deleteRequest.onsuccess = () => resolve();
            deleteRequest.onerror = () => reject(deleteRequest.error);
        });

        // 4. 等待一小段时间确保数据库完全删除
        await new Promise(resolve => setTimeout(resolve, 100));

        // 5. 重新初始化数据库
        await initDB();

        // 6. 重新加载页面
        window.location.reload();
    } catch (error) {
        console.error('重置失败：', error);
        alert('重置失败：' + error.message);
    }
}

// 修改 getPinnedUsers 函数，使用现有的 db 对象
async function getPinnedUsers() {
    return new Promise((resolve, reject) => {
        try {
            const transaction = db.transaction(['pinnedUsers'], 'readonly');
            const store = transaction.objectStore('pinnedUsers');
            const request = store.get('pinnedList');
            
            request.onsuccess = () => {
                resolve(request.result?.users || []);
            };
            request.onerror = () => reject(request.error);
        } catch (error) {
            reject(error);
        }
    });
}

// 修改 updatePinnedUsers 函数
async function updatePinnedUsers(userId, isPinned, clearAll = false, priority = 0) {
    return new Promise((resolve, reject) => {
        try {
            const transaction = db.transaction(['pinnedUsers'], 'readwrite');
            const store = transaction.objectStore('pinnedUsers');
            
            const request = store.get('pinnedList');
            request.onsuccess = () => {
                let pinnedData = request.result || { id: 'pinnedList', users: [] };
                
                if (clearAll) {
                    pinnedData.users = [];
                } else if (isPinned) {
                    // 如果用户已经在列表中，更新优先级
                    const existingIndex = pinnedData.users.findIndex(u => u.userId === userId);
                    if (existingIndex !== -1) {
                        pinnedData.users[existingIndex].priority = priority;
                    } else {
                        // 添加新的置顶用户
                        pinnedData.users.push({ userId, priority });
                    }
                } else {
                    // 移除置顶用户
                    pinnedData.users = pinnedData.users.filter(u => u.userId !== userId);
                }

                // 按优先级排序
                pinnedData.users.sort((a, b) => b.priority - a.priority);
                
                const putRequest = store.put(pinnedData);
                putRequest.onsuccess = () => resolve();
                putRequest.onerror = () => reject(putRequest.error);
            };
            
            request.onerror = () => reject(request.error);
        } catch (error) {
            reject(error);
        }
    });
}

const updateUserAvatar = async (userId, avatarData) => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['users'], 'readwrite');
        const store = transaction.objectStore('users');
        
        const request = store.get(userId);
        request.onsuccess = () => {
            const user = request.result;
            if (user) {
                user.avatar = avatarData;
                store.put(user);
                resolve();
            } else {
                reject(new Error('用户不存在'));
            }
        };
        request.onerror = () => reject(request.error);
    });
};

// 在 main.js 中添加 getUser 函数
const getUser = async (userId) => {
    return new Promise((resolve, reject) => {
        try {
            const transaction = db.transaction(['users'], 'readonly');
            const store = transaction.objectStore('users');
            const request = store.get(userId);

            request.onsuccess = () => {
                const user = request.result;
                resolve(user || {
                    userId,
                    totalDeposit: '0.00',
                    totalWithdrawal: '0.00',
                    note: '',
                    registerTime: new Date().toISOString()
                });
            };

            request.onerror = () => {
                reject(request.error);
            };
        } catch (error) {
            reject(error);
        }
    });
};

// 修改 loadUsers 函数中的排序逻辑
const loadUsers = async () => {
    try {
        const users = await getAllUsers();
        const pinnedUsers = await getPinnedUsers();
        
        // 过滤用户...

        // 修改排序逻辑
        filteredUsers.sort((a, b) => {
            const pinnedA = pinnedUsers.find(p => p.userId === a.userId);
            const pinnedB = pinnedUsers.find(p => p.userId === b.userId);
            
            // 首先按置顶优先级排序
            if (pinnedA || pinnedB) {
                if (!pinnedA) return 1;
                if (!pinnedB) return -1;
                if (pinnedA.priority !== pinnedB.priority) {
                    return pinnedB.priority - pinnedA.priority;
                }
            }
            
            // 其次按选择的字段排序
            // ... 现有的排序逻辑 ...
        });

        // 更新表格内容
        const tbody = document.getElementById('userTableBody');
        tbody.innerHTML = filteredUsers.map(user => {
            const pinnedInfo = pinnedUsers.find(p => p.userId === user.userId);
            const pinBtnClass = !pinnedInfo ? '' : 
                              pinnedInfo.priority === 2 ? 'priority-pinned' :
                              pinnedInfo.priority === 1 ? 'pinned' : '';
            
            return `
                <tr>
                    <td>
                        <button class="btn btn-sm btn-light pin-user-btn ${pinBtnClass}" 
                                data-user-id="${user.userId}">
                            <i class="fas fa-thumbtack"></i>
                        </button>
                    </td>
                    <!-- 其他单元格... -->
                </tr>
            `;
        }).join('');

        // 绑定置顶按钮事件
        document.querySelectorAll('.pin-user-btn').forEach(btn => {
            btn.addEventListener('click', async function() {
                const userId = this.dataset.userId;
                const currentPinned = pinnedUsers.find(p => p.userId === userId);
                const currentPriority = currentPinned ? currentPinned.priority : 0;
                
                // 循环切换：不置顶(0) -> 置顶(1) -> 优先置顶(2) -> 不置顶(0)
                const newPriority = currentPriority === 2 ? 0 : currentPriority + 1;
                
                await updatePinnedUsers(userId, newPriority > 0, false, newPriority);
                await loadUsers();
            });
        });
    } catch (error) {
        console.error('Error loading users:', error);
        alert('加载用户列表失败：' + error.message);
    }
};
