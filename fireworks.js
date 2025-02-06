class Fireworks {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.particles = [];
        this.numberOfParticles = 100;
        
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    createParticles(x, y) {
        const colors = ['#ff4444', '#ffbb33', '#00C851', '#33b5e5', '#aa66cc'];
        
        for (let i = 0; i < this.numberOfParticles; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 5 + 2;
            const color = colors[Math.floor(Math.random() * colors.length)];
            
            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 100,
                color: color,
                size: Math.random() * 3 + 1
            });
        }
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.05; // 重力效果
            p.life--;

            if (p.life <= 0) {
                this.particles.splice(i, 1);
                continue;
            }

            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fillStyle = p.color;
            this.ctx.fill();
        }

        if (this.particles.length > 0) {
            requestAnimationFrame(() => this.animate());
        }
    }

    start(fireworkCount) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.particles = [];
        
        for (let i = 0; i < fireworkCount; i++) {
            const x = Math.random() * this.canvas.width;
            const y = Math.random() * this.canvas.height * 0.5;
            this.createParticles(x, y);
        }
        
        this.animate();
    }
}

function showFireworks(amount) {
    console.log('调用 showFireworks');
    const canvas = document.getElementById('fireworksCanvas');
    if (!canvas) {
        console.error('找不到烟花画布元素');
        return;
    }
    console.log('找到画布元素');
    
    const fireworks = new Fireworks(canvas);
    
    if (amount >= 1000) {
        // 第一次放一朵
        fireworks.start(1);
        console.log('开始第一次烟花动画');
        
        // 第二次放两朵，延迟2秒
        setTimeout(() => {
            fireworks.start(2);
            console.log('开始第二次烟花动画');
        }, 2000);
    }
}