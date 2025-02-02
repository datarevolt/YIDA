// 数据库初始化
let db;
const DB_NAME = 'FinanceDB';
const DB_VERSION = 1;

const initDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            // 创建订单表
            if (!db.objectStoreNames.contains('orders')) {
                const orderStore = db.createObjectStore('orders', { keyPath: 'id', autoIncrement: true });
                orderStore.createIndex('userId', 'userId', { unique: false });
                orderStore.createIndex('submitTime', 'submitTime', { unique: false });
                orderStore.createIndex('orderDate', 'orderDate', { unique: false });
            }
            
            // 创建用户表
            if (!db.objectStoreNames.contains('users')) {
                const userStore = db.createObjectStore('users', { keyPath: 'userId' });
                userStore.createIndex('registerTime', 'registerTime', { unique: false });
            }
        };
    });
};

// 格式化日期
const formatDate = (date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// 添加订单
const addOrder = async (data) => {
    return new Promise((resolve, reject) => {
        try {
            const transaction = db.transaction(['orders', 'users'], 'readwrite');
            const orderStore = transaction.objectStore('orders');
            const userStore = transaction.objectStore('users');

            // 准备订单数据
            const orderData = {
                ...data,
                submitTime: new Date().toISOString(),
                orderDate: data.orderDate,
                amount: parseFloat(data.amount)
            };

            // 检查并更新用户数据
            const getUserRequest = userStore.get(data.userId);
            getUserRequest.onsuccess = () => {
                let user = getUserRequest.result;
                
                if (!user) {
                    // 新用户：直接使用订单日期字符串，不做任何转换
                    user = {
                        userId: data.userId,
                        registerTime: orderData.orderDate, // 直接使用订单日期字符串
                        totalDeposit: 0,
                        totalWithdrawal: 0,
                        note: ''
                    };
                }

                // 更新用户统计数据
                if (data.type === 'deposit') {
                    user.totalDeposit = (parseFloat(user.totalDeposit) || 0) + parseFloat(data.amount);
                } else {
                    user.totalWithdrawal = (parseFloat(user.totalWithdrawal) || 0) + parseFloat(data.amount);
                }

                // 保存用户数据
                const putUserRequest = userStore.put(user);
                putUserRequest.onsuccess = () => {
                    // 保存订单数据
                    const addOrderRequest = orderStore.add(orderData);
                    addOrderRequest.onsuccess = () => resolve();
                    addOrderRequest.onerror = () => reject(new Error('保存订单失败'));
                };
                putUserRequest.onerror = () => reject(new Error('更新用户数据失败'));
            };

            getUserRequest.onerror = () => reject(new Error('获取用户数据失败'));
            transaction.onerror = () => reject(transaction.error);
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