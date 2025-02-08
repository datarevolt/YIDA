// 天气预报管理模块
const WeatherManager = {
    apiKey: 'AHPQ8LDPYJFQHNNRWKGDU6HDQ',
    visualCrossingKey: 'AHPQ8LDPYJFQHNNRWKGDU6HDQ',
    openWeatherKey: 'ec1f424816b8dcd31ae2a267af840b74',
    defaultCity: {
        lat: 30.3322,
        lon: -81.6557,
        name: '杰克逊维尔',
        state: '佛罗里达州',
        country: '美国'
    },

    // 常用美国城市列表
    commonCities: [
        {
            lat: 30.3322,
            lon: -81.6557,
            name: '杰克逊维尔',
            state: '佛罗里达州',
            country: '美国'
        },
        {
            lat: 25.7617,
            lon: -80.1918,
            name: '迈阿密',
            state: '佛罗里达州',
            country: '美国'
        },
        {
            lat: 28.5383,
            lon: -81.3792,
            name: '奥兰多',
            state: '佛罗里达州',
            country: '美国'
        },
        {
            lat: 27.9506,
            lon: -82.4572,
            name: '坦帕',
            state: '佛罗里达州',
            country: '美国'
        },
        {
            lat: 40.7128,
            lon: -74.0060,
            name: '纽约',
            state: '纽约州',
            country: '美国'
        }
    ],

    // 添加城市名称映射表（包含州名）
    cityNameMap: {
        // 佛罗里达州城市
        'Jacksonville, Florida': {
            name: '杰克逊维尔',
            state: '佛罗里达州'
        },
        'Miami, Florida': {
            name: '迈阿密',
            state: '佛罗里达州'
        },
        'Orlando, Florida': {
            name: '奥兰多',
            state: '佛罗里达州'
        },
        'Tampa, Florida': {
            name: '坦帕',
            state: '佛罗里达州'
        },
        // 其他州城市
        'New York, New York': {
            name: '纽约',
            state: '纽约州'
        },
        'Los Angeles, California': {
            name: '洛杉矶',
            state: '加利福尼亚州'
        },
        'Chicago, Illinois': {
            name: '芝加哥',
            state: '伊利诺伊州'
        },
        'Houston, Texas': {
            name: '休斯顿',
            state: '德克萨斯州'
        }
        // ... 可以继续添加更多城市
    },

    // 获取中文城市信息
    getChineseInfo: function(englishName, state) {
        const key = `${englishName}, ${state}`;
        const info = this.cityNameMap[key] || {
            name: englishName,
            state: state
        };
        return info;
    },

    // 天气描述映射表（英文到中文）
    weatherDescriptions: {
        'clear sky': '晴朗',
        'few clouds': '少云',
        'scattered clouds': '多云',
        'broken clouds': '阴',
        'shower rain': '阵雨',
        'rain': '雨',
        'thunderstorm': '雷雨',
        'snow': '雪',
        'mist': '雾',
        'overcast clouds': '阴天'
        // 可以根据需要添加更多映射
    },

    // 初始化
    init: async function() {
        const savedCity = localStorage.getItem('weatherCity');
        this.city = savedCity ? JSON.parse(savedCity) : this.defaultCity;
        
        // 初始化城市选择功能
        this.initCitySelection();
        
        // 更新显示的城市名
        this.updateCityDisplay();

        // 加载天气数据
        await this.loadWeatherData();

        // 设置自动刷新
        setInterval(() => this.loadWeatherData(), 30 * 60 * 1000);

        const weatherDisplay = document.getElementById('weatherDisplay');
        const weatherHoverContent = document.querySelector('.weather-hover-content');
        let isHoverContentVisible = false;
        let isMouseOver = false;

        // 点击切换显示状态
        weatherDisplay.addEventListener('click', (e) => {
            e.stopPropagation();
            isHoverContentVisible = !isHoverContentVisible;
            weatherHoverContent.style.display = isHoverContentVisible ? 'block' : 'none';
        });

        // 鼠标悬浮显示
        weatherDisplay.addEventListener('mouseenter', () => {
            isMouseOver = true;
            weatherHoverContent.style.display = 'block';
        });

        // 鼠标离开容器区域时隐藏
        const weatherContainer = document.getElementById('weatherContainer');
        weatherContainer.addEventListener('mouseleave', () => {
            isMouseOver = false;
            // 如果不是点击显示状态，则隐藏
            if (!isHoverContentVisible) {
                weatherHoverContent.style.display = 'none';
            }
        });

        // 点击悬浮窗内部不关闭
        weatherHoverContent.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // 点击页面其他地方关闭悬浮窗
        document.addEventListener('click', () => {
            isHoverContentVisible = false;
            if (!isMouseOver) {
                weatherHoverContent.style.display = 'none';
            }
        });
    },

    // 初始化城市选择功能
    initCitySelection: function() {
        // 添加城市选择点击事件
        const locationEl = document.getElementById('weatherLocation');
        if (locationEl) {
            locationEl.addEventListener('click', () => this.showCitySelector());
        }

        // 初始化搜索输入
        const searchInput = document.getElementById('citySearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                if (e.target.value.trim().length >= 2) {
                    this.searchCities(e.target.value.trim());
                }
            });
        }
    },

    // 显示城市选择器
    showCitySelector: function() {
        const cityList = document.getElementById('cityList');
        if (cityList) {
            // 显示常用城市列表
            cityList.innerHTML = this.commonCities.map(city => `
                <button class="list-group-item list-group-item-action" 
                        data-lat="${city.lat}" 
                        data-lon="${city.lon}" 
                        data-name="${city.name}"
                        data-state="${city.state}"
                        data-country="${city.country}">
                    ${city.name}
                    <small class="text-muted">${city.state}</small>
                </button>
            `).join('');

            // 添加城市选择事件
            cityList.addEventListener('click', (e) => {
                const cityBtn = e.target.closest('.list-group-item');
                if (cityBtn) {
                    const newCity = {
                        lat: parseFloat(cityBtn.dataset.lat),
                        lon: parseFloat(cityBtn.dataset.lon),
                        name: cityBtn.dataset.name,
                        state: cityBtn.dataset.state,
                        country: cityBtn.dataset.country
                    };
                    this.changeCity(newCity);
                    $('#locationModal').modal('hide');
                }
            });
        }

        // 显示模态框
        $('#locationModal').modal('show');
    },

    // 搜索城市
    searchCities: async function(query) {
        try {
            const response = await fetch(
                `https://api.openweathermap.org/geo/1.0/direct?` +
                `q=${encodeURIComponent(query)}&` +
                `limit=5&` +
                `appid=${this.openWeatherKey}`
            );
            
            if (!response.ok) throw new Error('City search failed');
            
            const cities = await response.json();
            const cityList = document.getElementById('cityList');
            
            if (cityList) {
                cityList.innerHTML = cities.map(city => {
                    const displayName = this.getChineseName(city.name);
                    const stateName = city.state || '';
                    const countryName = city.country === 'US' ? '美国' : city.country;
                    
                    return `
                        <button class="list-group-item list-group-item-action" 
                                data-lat="${city.lat}" 
                                data-lon="${city.lon}" 
                                data-name="${displayName}"
                                data-state="${stateName}"
                                data-country="${countryName}">
                            ${displayName}
                            <small class="text-muted">
                                ${stateName ? `${stateName}, ` : ''}${countryName}
                            </small>
                        </button>
                    `;
                }).join('');
            }
        } catch (error) {
            console.error('城市搜索失败:', error);
        }
    },

    // 更改城市
    changeCity: async function(newCity) {
        this.city = newCity;
        localStorage.setItem('weatherCity', JSON.stringify(newCity));
        this.updateCityDisplay();
        await this.loadWeatherData();
    },

    // 更新城市显示
    updateCityDisplay: function() {
        const locationEl = document.getElementById('weatherLocation');
        if (locationEl) {
            locationEl.textContent = `${this.city.name}, ${this.city.state}`;
        }
    },

    // 加载天气数据
    loadWeatherData: async function() {
        try {
            await Promise.all([
                this.fetchWeather(),
                this.fetchHistoricalWeather()
            ]);
        } catch (error) {
            console.error('加载天气数据失败:', error);
        }
    },

    // 获取中文城市名
    getChineseName: function(englishName) {
        const cityNameMap = {
            'Jacksonville': '杰克逊维尔',
            'Miami': '迈阿密',
            'Orlando': '奥兰多',
            'Tampa': '坦帕',
            'New York': '纽约',
            'Los Angeles': '洛杉矶',
            'Chicago': '芝加哥',
            'Houston': '休斯顿',
            'Phoenix': '凤凰城',
            'Philadelphia': '费城'
        };
        return cityNameMap[englishName] || englishName;
    },

    // 获取天气描述的中文
    getChineseDesc: function(englishDesc) {
        return this.weatherDescriptions[englishDesc.toLowerCase()] || englishDesc;
    },

    // 摄氏度转华氏度
    celsiusToFahrenheit: function(celsius) {
        return Math.round((celsius * 9/5) + 32);
    },

    // 获取天气数据
    fetchWeather: async function() {
        try {
            // 获取当前天气
            const currentResponse = await fetch(
                `https://api.openweathermap.org/data/2.5/weather?` +
                `lat=${this.city.lat}&` +
                `lon=${this.city.lon}&` +
                `units=metric&` +
                `lang=zh_cn&` +
                `appid=${this.openWeatherKey}`
            );

            if (!currentResponse.ok) throw new Error(`HTTP error! status: ${currentResponse.status}`);
            const currentData = await currentResponse.json();

            // 获取预报数据
            const forecastResponse = await fetch(
                `https://api.openweathermap.org/data/2.5/forecast?` +
                `lat=${this.city.lat}&` +
                `lon=${this.city.lon}&` +
                `units=metric&` +
                `lang=zh_cn&` +
                `appid=${this.openWeatherKey}`
            );

            if (!forecastResponse.ok) throw new Error(`HTTP error! status: ${forecastResponse.status}`);
            const forecastData = await forecastResponse.json();

            // 更新导航栏天气显示
            this.updateNavWeather(currentData);
            // 更新预报显示
            this.updateForecast(currentData, forecastData);

            // 更新天气显示
            this.updateWeatherDisplay(currentData);
        } catch (error) {
            console.error('获取天气预报失败:', error);
        }
    },

    // 更新导航栏天气显示
    updateNavWeather: function(currentData) {
        const tempEl = document.getElementById('weatherTemp');
        const descEl = document.getElementById('weatherDesc');
        
        if (tempEl && descEl) {
            tempEl.textContent = Math.round(this.celsiusToFahrenheit(currentData.main.temp));
            descEl.textContent = currentData.weather[0].description;
        }
    },

    // 更新12小时预报显示
    updateForecast: function(currentData, forecastData) {
        const forecastEl = document.getElementById('hourlyForecast');
        if (forecastEl) {
            // 当前天气
            const currentHour = {
                dt: Date.now() / 1000,
                main: currentData.main,
                weather: currentData.weather,
                isNow: true
            };

            // 未来11个时段
            const hourlyData = [currentHour, ...forecastData.list.slice(0, 11)];

            const forecastHtml = hourlyData.map(item => {
                const time = item.isNow ? '现在' : 
                    new Date(item.dt * 1000).toLocaleTimeString('zh-CN', {
                        hour: '2-digit',
                        minute: '2-digit'
                    });

                return `
                    <div class="forecast-item ${item.isNow ? 'current' : ''}">
                        <div class="time">${time}</div>
                        <img src="https://openweathermap.org/img/wn/${item.weather[0].icon}.png" 
                             alt="${item.weather[0].description}">
                        <div class="temp">${Math.round(this.celsiusToFahrenheit(item.main.temp))}°</div>
                        <div class="desc">${item.weather[0].description}</div>
                    </div>
                `;
            }).join('');

            forecastEl.innerHTML = forecastHtml;
        }
    },

    // 错误处理
    handleError: function(error) {
        const tempEl = document.getElementById('weatherTemp');
        const descEl = document.getElementById('weatherDesc');
        if (tempEl) tempEl.textContent = '--';
        if (descEl) descEl.textContent = '获取失败 ';

        // 尝试使用缓存数据
        const cached = localStorage.getItem('weatherData');
        if (cached) {
            const { timestamp, data } = JSON.parse(cached);
            const isCacheValid = (Date.now() - timestamp) < 3600000; // 1小时内的缓存有效
            if (isCacheValid) {
                this.updateForecast(data.current, data.forecast);
                console.log('使用缓存的天气数据');
            }
        }
    },

    // 显示天气弹窗
    showWeatherModal: async function() {
        try {
            // 获取详细天气数据
            const response = await fetch(
                `https://api.openweathermap.org/data/2.5/forecast?` +
                `lat=${this.city.lat}&` +
                `lon=${this.city.lon}&` +
                `units=metric&` +
                `lang=zh_cn&` +
                `appid=${this.apiKey}`
            );

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();

            this.updateDetailedWeather(data);
            
            document.getElementById('weatherModal').style.display = 'block';
            document.getElementById('weatherModalBackdrop').style.display = 'block';
        } catch (error) {
            console.error('获取详细天气数据失败:', error);
        }
    },

    // 隐藏天气弹窗
    hideWeatherModal: function() {
        document.getElementById('weatherModal').style.display = 'none';
        document.getElementById('weatherModalBackdrop').style.display = 'none';
    },

    // 切换标签
    switchTab: function(tabId) {
        document.querySelectorAll('.weather-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabId);
        });
        document.querySelectorAll('.weather-tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `weather${tabId.charAt(0).toUpperCase() + tabId.slice(1)}`);
        });
    },

    // 更新详细天气信息
    updateDetailedWeather: function(data) {
        // 更新小时预报
        const hourlyEl = document.getElementById('hourlyForecast');
        if (hourlyEl) {
            const hourlyHtml = data.list.slice(0, 8).map(item => {
                const time = new Date(item.dt * 1000).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
                return `
                    <div class="hourly-item">
                        <div class="time">${time}</div>
                        <img class="weather-icon" src="https://openweathermap.org/img/wn/${item.weather[0].icon}.png" 
                             alt="${item.weather[0].description}">
                        <div class="temp">${this.celsiusToFahrenheit(item.main.temp)}°F</div>
                        <div class="desc">${item.weather[0].description}</div>
                        <div class="humidity">湿度: ${item.main.humidity}%</div>
                    </div>
                `;
            }).join('');
            hourlyEl.innerHTML = `<div class="hourly-list">${hourlyHtml}</div>`;
        }

        // 更新日预报
        const dailyEl = document.getElementById('dailyForecast');
        if (dailyEl) {
            const dailyData = [];
            for (let i = 0; i < data.list.length; i += 8) {
                dailyData.push(data.list[i]);
            }

            const dailyHtml = dailyData.map(item => {
                const date = new Date(item.dt * 1000).toLocaleDateString('zh-CN', { weekday: 'short', month: 'numeric', day: 'numeric' });
                return `
                    <div class="daily-item">
                        <div class="date">${date}</div>
                        <img class="weather-icon" src="https://openweathermap.org/img/wn/${item.weather[0].icon}.png" 
                             alt="${item.weather[0].description}">
                        <div class="temp-range">
                            <span class="temp-high">${this.celsiusToFahrenheit(item.main.temp_max)}°F</span>
                            <span class="temp-low">${this.celsiusToFahrenheit(item.main.temp_min)}°F</span>
                        </div>
                        <div class="desc">${item.weather[0].description}</div>
                        <div class="humidity">湿度: ${item.main.humidity}%</div>
                        <div class="wind">风速: ${Math.round(item.wind.speed * 2.237)}mph</div>
                    </div>
                `;
            }).join('');
            dailyEl.innerHTML = `<div class="daily-list">${dailyHtml}</div>`;
        }
    },

    // 获取历史天气
    fetchHistoricalWeather: async function() {
        try {
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 7);

            const formatDate = (date) => date.toISOString().split('T')[0];

            const url = `https://archive-api.open-meteo.com/v1/archive?` +
                `latitude=${this.city.lat}&` +
                `longitude=${this.city.lon}&` +
                `start_date=${formatDate(startDate)}&` +
                `end_date=${formatDate(endDate)}&` +
                `daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode&` +
                `timezone=America%2FNew_York`;

            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const data = await response.json();
            this.updateHistoricalWeather(data);
        } catch (error) {
            console.error('获取历史天气失败:', error);
            this.showHistoryError();
        }
    },

    // 更新历史天气显示
    updateHistoricalWeather: function(data) {
        const historyEl = document.getElementById('weatherHistory');
        if (historyEl && data.daily) {
            const weatherCodes = {
                0: '晴天',
                1: '多云',
                2: '阴天',
                3: '阴天',
                45: '雾',
                48: '雾凇',
                51: '小毛毛雨',
                53: '毛毛雨',
                55: '大毛毛雨',
                61: '小雨',
                63: '中雨',
                65: '大雨',
                71: '小雪',
                73: '中雪',
                75: '大雪',
                95: '雷雨',
                96: '雷阵雨伴有冰雹',
                99: '暴雨伴有冰雹'
            };

            const historyHtml = data.daily.time.map((date, index) => {
                const weatherCode = data.daily.weathercode[index];
                const weatherDesc = weatherCodes[weatherCode] || '未知天气';
                const maxTemp = data.daily.temperature_2m_max[index];
                const minTemp = data.daily.temperature_2m_min[index];
                const precipitation = data.daily.precipitation_sum[index];

                return `
                    <div class="history-item">
                        <div class="date">${new Date(date).toLocaleDateString('zh-CN', {
                            weekday: 'short',
                            month: 'numeric',
                            day: 'numeric'
                        })}</div>
                        <div class="temp-range">
                            <span class="temp-high">↑${Math.round(this.celsiusToFahrenheit(maxTemp))}°</span>
                            <span class="temp-low">↓${Math.round(this.celsiusToFahrenheit(minTemp))}°</span>
                        </div>
                        <div class="desc">${weatherDesc}</div>
                        ${precipitation > 0 ? 
                            `<div class="precip">降水: ${precipitation}mm</div>` : 
                            ''}
                    </div>
                `;
            }).join('');

            historyEl.innerHTML = historyHtml;
        }
    },

    // 显示历史数据错误信息
    showHistoryError: function() {
        const historyEl = document.getElementById('weatherHistory');
        if (historyEl) {
            historyEl.innerHTML = `
                <div class="history-error">
                    <p>暂时无法获取历史天气数据</p>
                    <p>请稍后再试</p>
                </div>
            `;
        }
    },

    // 更新天气显示
    updateWeatherDisplay: function(weatherData) {
        const weatherDisplay = document.getElementById('weatherDisplay');
        
        // 移除所有天气状态类
        weatherDisplay.classList.remove('sunny', 'cloudy', 'rainy', 'snowy', 'thunderstorm', 'windy');
        
        // 根据天气状态添加对应的类
        const weatherCondition = this.getWeatherCondition(weatherData.weather[0].id);
        weatherDisplay.classList.add(weatherCondition);
        
        // 更新天气图标
        const weatherIcon = this.getWeatherIcon(weatherData.weather[0].id);
        document.querySelector('#weatherDisplay i.fas').className = `fas ${weatherIcon}`;
        
        // 更新其他天气信息
        document.getElementById('weatherDesc').textContent = weatherData.weather[0].description;
        document.getElementById('weatherTemp').textContent = Math.round(this.celsiusToFahrenheit(weatherData.main.temp));

        // 更新悬浮窗背景
        const weatherHoverContent = document.querySelector('.weather-hover-content');
        weatherHoverContent.classList.remove('sunny', 'cloudy', 'rainy', 'snowy', 'thunderstorm', 'windy');
        weatherHoverContent.classList.add(this.getWeatherCondition(weatherData.weather[0].id));
    },

    getWeatherCondition: function(weatherId) {
        if (weatherId >= 200 && weatherId < 300) return 'thunderstorm';
        if (weatherId >= 300 && weatherId < 600) return 'rainy';
        if (weatherId >= 600 && weatherId < 700) return 'snowy';
        if (weatherId >= 700 && weatherId < 800) return 'windy';
        if (weatherId === 800) return 'sunny';
        if (weatherId > 800) return 'cloudy';
        return 'sunny'; // 默认值
    },

    getWeatherIcon: function(weatherId) {
        if (weatherId >= 200 && weatherId < 300) return 'fa-bolt';           // 雷暴
        if (weatherId >= 300 && weatherId < 600) return 'fa-cloud-rain';     // 雨
        if (weatherId >= 600 && weatherId < 700) return 'fa-snowflake';      // 雪
        if (weatherId >= 700 && weatherId < 800) return 'fa-wind';           // 大风
        if (weatherId === 800) return 'fa-sun';                              // 晴天
        if (weatherId > 800) return 'fa-cloud';                              // 多云
        return 'fa-sun'; // 默认值
    }
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => WeatherManager.init()); 