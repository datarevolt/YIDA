// 数据库初始化
let db;
const DB_NAME = 'FinanceDB';
const DB_VERSION = 1;

const Database = {
    init: async (dbName, version, storeSchemas) => {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(dbName, version);
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                for (const storeName in storeSchemas) {
                    if (!db.objectStoreNames.contains(storeName)) {
                        db.createObjectStore(storeName, storeSchemas[storeName]);
                    }
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
};

async function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
            console.error('数据库打开失败:', event.target.error);
            reject(event.target.error);
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            console.log('数据库连接成功');
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            // 创建用户表
            if (!db.objectStoreNames.contains('users')) {
                const usersStore = db.createObjectStore('users', { keyPath: 'userId' });
                usersStore.createIndex('registerTime', 'registerTime', { unique: false });
                usersStore.createIndex('totalDeposit', 'totalDeposit', { unique: false });
                usersStore.createIndex('totalWithdrawal', 'totalWithdrawal', { unique: false });
            }

            // 创建订单表
            if (!db.objectStoreNames.contains('orders')) {
                const ordersStore = db.createObjectStore('orders', { keyPath: 'id', autoIncrement: true });
                ordersStore.createIndex('userId', 'userId', { unique: false });
                ordersStore.createIndex('orderDate', 'orderDate', { unique: false });
                ordersStore.createIndex('type', 'type', { unique: false });
            }

            // 创建计划表
            if (!db.objectStoreNames.contains('plans')) {
                const plansStore = db.createObjectStore('plans', { keyPath: 'id', autoIncrement: true });
                plansStore.createIndex('userId', 'userId', { unique: false });
                plansStore.createIndex('planTime', 'planTime', { unique: false });
                plansStore.createIndex('status', 'status', { unique: false });
            }

            console.log('数据库升级完成');
        };
    });
}

// 获取用户信息
async function getUser(userId) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['users'], 'readonly');
        const store = transaction.objectStore('users');
        const request = store.get(userId);

        request.onsuccess = () => {
            resolve(request.result || { userId, totalDeposit: 0, totalWithdrawal: 0, note: '' });
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
}

// 更新用户备注
async function updateUserNote(userId, note) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['users'], 'readwrite');
        const store = transaction.objectStore('users');
        
        // 先获取用户数据
        const getRequest = store.get(userId);
        
        getRequest.onsuccess = () => {
            const userData = getRequest.result || {
                userId,
                totalDeposit: 0,
                totalWithdrawal: 0,
                registerTime: new Date().toISOString()
            };
            
            userData.note = note;
            
            // 更新用户数据
            const putRequest = store.put(userData);
            
            putRequest.onsuccess = () => resolve();
            putRequest.onerror = () => reject(putRequest.error);
        };
        
        getRequest.onerror = () => reject(getRequest.error);
    });
} 