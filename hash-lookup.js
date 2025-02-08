const HashLookup = {
    // API Keys
    ETHERSCAN_API_KEY: 'QDIH2VW6CWAEKUQQF6N3SRKVJ8DRUF6AE6',
    
    networks: {
        ethereum: {
            pattern: '^0x[a-fA-F0-9]{40}$',
            url: 'https://etherscan.io/address/',
            txUrl: 'https://etherscan.io/tx/',
            name: 'ETH'
        },
        bitcoin: {
            pattern: '^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$',
            url: 'https://www.blockchain.com/explorer/addresses/btc/',
            txUrl: 'https://www.blockchain.com/explorer/transactions/btc/',
            name: '比特币'
        },
        tron: {
            pattern: '^T[A-Za-z0-9]{33}$',
            url: 'https://tronscan.org/#/address/',
            txUrl: 'https://tronscan.org/#/transaction/',
            name: 'TRC20-USDT'
        },
        solana: {
            pattern: '^[1-9A-HJ-NP-Za-km-z]{32,44}$',
            url: 'https://solscan.io/account/',
            txUrl: 'https://solscan.io/tx/',
            name: 'Solana'
        },
        ton: {
            pattern: '^(UQ|EQ)[A-Za-z0-9_-]{46}$',
            url: 'https://tonapi.io/account/',
            txUrl: 'https://tonapi.io/transaction/', 
            name: 'TON'
        },
        // 交易哈希
        ethHash: {
            pattern: '^0x[a-fA-F0-9]{64}$',
            url: 'https://www.okx.com/explorer/eth/tx/'
        },
        btcHash: {
            pattern: '^[a-fA-F0-9]{64}$',
            url: 'https://www.okx.com/explorer/btc/tx/'
        }
    },

    init() {
        // 绑定搜索按钮点击事件
        document.getElementById('quickHashSearch')?.addEventListener('click', () => {
            const input = document.getElementById('quickHashInput');
            if (input) {
                this.searchHash(input.value);
            }
        });

        // 绑定输入框回车事件
        document.getElementById('quickHashInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const input = e.target;
                this.searchHash(input.value);
            }
        });
    },

    async searchHash(hash) {
        console.log('开始搜索哈希:', hash);
        if (!hash) {
            alert('请输入要搜索的地址或哈希值');
            return;
        }

        try {
            // 检查是否是以太坊交易哈希
            if (/^0x[a-fA-F0-9]{64}$/.test(hash)) {
                window.open(this.networks.ethereum.txUrl + hash, '_blank');
                return;
            }

            // 检查是否是比特币交易哈希
            if (/^[a-fA-F0-9]{64}$/.test(hash)) {
                window.open(this.networks.bitcoin.txUrl + hash, '_blank');
                return;
            }

            // 检查是否是波场交易哈希
            if (/^[A-Za-z0-9]{64}$/.test(hash)) {
                window.open(this.networks.tron.txUrl + hash, '_blank');
                return;
            }

            // 特殊处理 TON 地址
            if (/^(UQ|EQ)[A-Za-z0-9_-]{46}$/.test(hash)) {
                console.log('检测到 TON 地址');
                window.open(`https://tonapi.io/account/${hash}`, '_blank');
                return;
            }

            // 检查其他地址类型
            for (const [network, info] of Object.entries(this.networks)) {
                if (new RegExp(info.pattern).test(hash)) {
                    console.log(`匹配到 ${info.name} 地址`);
                    window.open(info.url + hash, '_blank');
                    return;
                }
            }

            // 如果看起来像 Solana 地址但不完全匹配模式，也尝试打开
            if (hash.length >= 32 && hash.length <= 44) {
                console.log('可能是 Solana 地址，尝试打开');
                window.open(this.networks.solana.url + hash, '_blank');
                return;
            }

            // 如果格式不匹配，显示支持的格式
            alert(`不支持的地址或交易哈希格式\n\n支持的网络：\n${Object.values(this.networks).map(n => n.name).join('\n')}`);
        } catch (error) {
            console.error('搜索出错:', error);
            alert('搜索过程中出现错误，请重试');
        }
    },

    formatError(error) {
        return `
            <div class="alert alert-warning">
                <h5>⚠️ ${error.message}</h5>
                <p>您可以直接在 OKX 区块链浏览器中查看详情</p>
                <div class="mt-3">
                    ${Object.entries(this.networks).map(([key, network]) => `
                        <a href="${network.explorer}/search/${document.getElementById('quickHashInput').value.trim()}" 
                           target="_blank" 
                           class="btn btn-sm btn-outline-primary mr-2 mb-2">
                            ${network.name}
                        </a>
                    `).join('')}
                </div>
            </div>
        `;
    },

    formatTokenBalance(balance, decimals = 18) {
        return (parseFloat(balance) / Math.pow(10, decimals)).toFixed(6);
    }
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    HashLookup.init();
});

// 导出以便调试
window.HashLookup = HashLookup;