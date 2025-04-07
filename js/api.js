class AmoAPI {
    constructor() {
        this.accessToken = localStorage.getItem('amo_access_token');
        this.queue = [];
        this.activeRequests = 0;
        this.limit = 2; // 2 запроса в секунду
    }

    // Авторизация
    async auth() {
        const state = this._generateRandomString();
        localStorage.setItem('oauth_state', state);
        const authUrl = `https://${CONFIG.DOMAIN}/oauth?client_id=${CONFIG.CLIENT_ID}&mode=popup&redirect_uri=${encodeURIComponent(CONFIG.REDIRECT_URI)}&response_type=code&state=${state}`;
        window.open(authUrl, 'Auth', 'width=600,height=400');

        return new Promise((resolve, reject) => {
            window.addEventListener('message', async (event) => {
                if (event.data.name === 'oauth-authorization-success') {
                    const code = event.data.code;
                    const stateFromEvent = event.data.state;
                    if (stateFromEvent !== state) {
                        reject(new Error('Invalid state parameter'));
                        return;
                    }
                    try {
                        await this.getToken(code);
                        resolve();
                    } catch (error) {
                        reject(error);
                    }
                }
            }, { once: true });
        });
    }

    // Получение токена
    async getToken(code) {
        const response = await this._request('/oauth2/access_token', {
            method: 'POST',
            body: JSON.stringify({
                client_id: CONFIG.CLIENT_ID,
                client_secret: CONFIG.CLIENT_SECRET,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: CONFIG.REDIRECT_URI
            })
        });
        
        this.accessToken = response.access_token;
        localStorage.setItem('amo_access_token', this.accessToken);
        return response;
    }

    // Получение сделок с ограничением запросов
    async fetchDeals() {
        let allDeals = [];
        let page = 1;
        
        while(true) {
            const data = await this._queueRequest(`/api/v4/leads?page=${page}&limit=2&with=contacts`);
            if (!data?._embedded?.leads) break;
            
            allDeals = [...allDeals, ...data._embedded.leads];
            if(data._embedded.leads.length < 2) break;
            page++;
        }
        
        return allDeals;
    }

    // Получение деталей сделки
    async fetchDealDetails(dealId) {
        return this._queueRequest(`/api/v4/leads/${dealId}?with=tasks,contacts`);
    }

    // Очередь запросов
    async _queueRequest(endpoint, options = {}) {
        return new Promise((resolve) => {
            this.queue.push({ endpoint, options, resolve });
            this._processQueue();
        });
    }

    _processQueue() {
        while (this.queue.length > 0 && this.activeRequests < this.limit) {
            const { endpoint, options, resolve } = this.queue.shift();
            this.activeRequests++;
            
            this._request(endpoint, options)
                .then(data => {
                    resolve(data);
                    setTimeout(() => {
                        this.activeRequests--;
                        this._processQueue();
                    }, 1000);
                })
                .catch(error => {
                    console.error('Queue error:', error);
                    setTimeout(() => {
                        this.activeRequests--;
                        this._processQueue();
                    }, 1000);
                });
        }
    }

    // Основной метод запроса с прокси
    async _request(endpoint, options = {}) {
        const url = `${CONFIG.PROXY_URL}https://${CONFIG.DOMAIN}${endpoint}`;
        const headers = {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
            ...options.headers
        };
        
        const response = await fetch(url, { ...options, headers });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    }

    // Задержка
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Генерация случайной строки для state
    _generateRandomString() {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }
}