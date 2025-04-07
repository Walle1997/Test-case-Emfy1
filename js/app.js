document.addEventListener('DOMContentLoaded', () => {
    const api = new AmoAPI();
    const dealsTable = document.getElementById('dealsTable');
    const dealsBody = document.getElementById('dealsBody');
    const authBtn = document.getElementById('authBtn');
    const loadingIndicator = document.getElementById('loading');

    // Обработчик авторизации
    authBtn.addEventListener('click', () => api.auth());

    // Обработчик сообщений
    window.addEventListener('message', async (event) => {
        if (event.data.type === 'amo_auth_code') {
            loadingIndicator.style.display = 'block';
            await api.getToken(event.data.code);
            await loadDeals();
            loadingIndicator.style.display = 'none';
        }
    });

    // Загрузка сделок
    async function loadDeals() {
        try {
            loadingIndicator.style.display = 'block';
            const deals = await api.fetchDeals();
            renderDeals(deals);
        } catch (error) {
            console.error('Ошибка загрузки:', error);
            alert('Ошибка загрузки. Проверьте авторизацию.');
        } finally {
            loadingIndicator.style.display = 'none';
        }
    }

    // Рендер таблицы
    function renderDeals(deals) {
        dealsBody.innerHTML = '';
        
        deals.forEach(deal => {
            const contact = deal._embedded?.contacts?.[0];
            const row = document.createElement('tr');
            row.dataset.dealId = deal.id;
            row.dataset.dealName = deal.name;
            row.dataset.dealPrice = deal.price || 0;
            
            row.innerHTML = `
                <td>${deal.id}</td>
                <td>${deal.name}</td>
                <td>${deal.price || 0} ₽</td>
                <td>${contact?.name || 'Нет контакта'}</td>
                <td>${getContactPhone(contact) || 'Нет телефона'}</td>
            `;
            
            row.addEventListener('click', () => toggleDealDetails(row, deal.id));
            dealsBody.appendChild(row);
        });
    }

    // Получение телефона контакта
    function getContactPhone(contact) {
        return contact?.custom_fields_values?.find(f => f.field_code === 'PHONE')?.values[0]?.value;
    }

    // Переключение деталей
    async function toggleDealDetails(row, dealId) {
        if (row.classList.contains('expanded')) {
            row.classList.remove('expanded');
            renderDealRow(row);
            return;
        }
        
        // Закрытие других строк
        document.querySelectorAll('tr.expanded').forEach(r => {
            r.classList.remove('expanded');
            renderDealRow(r);
        });
        
        // Загрузка данных
        row.classList.add('expanded');
        row.innerHTML = `<td colspan="5"><div class="spinner"></div></td>`;
        
        try {
            const data = await api.fetchDealDetails(dealId);
            renderExpandedRow(row, data);
        } catch (error) {
            console.error('Ошибка:', error);
            row.classList.remove('expanded');
            renderDealRow(row);
        }
    }

    // Рендер развернутой строки
    function renderExpandedRow(row, data) {
        const task = data._embedded?.tasks?.[0];
        const statusColor = getTaskStatus(task);
        
        row.innerHTML = `
            <td colspan="5">
                <div class="deal-details">
                    <h4>${data.name}</h4>
                    <p><strong>ID:</strong> ${data.id}</p>
                    <p><strong>Дата:</strong> ${new Date(data.created_at * 1000).toLocaleDateString()}</p>
                    <p><strong>Задача:</strong> 
                        <svg width="12" height="12"><circle cx="6" cy="6" r="5" fill="${statusColor}"/></svg>
                        ${task?.name || 'Нет задачи'}
                    </p>
                    <button class="btn btn-sm btn-close"></button>
                </div>
            </td>
        `;
        
        row.querySelector('.btn-close').addEventListener('click', (e) => {
            e.stopPropagation();
            row.classList.remove('expanded');
            renderDealRow(row);
        });
    }

    // Восстановление строки
    function renderDealRow(row) {
        row.innerHTML = `
            <td>${row.dataset.dealId}</td>
            <td>${row.dataset.dealName}</td>
            <td>${row.dataset.dealPrice} ₽</td>
            <td>${row.dataset.contactName || 'Нет контакта'}</td>
            <td>${row.dataset.contactPhone || 'Нет телефона'}</td>
        `;
    }

    // Определение статуса задачи
    function getTaskStatus(task) {
        if (!task?.complete_till_at) return 'red';
        
        const taskDate = new Date(task.complete_till_at * 1000);
        const today = new Date();
        
        if (taskDate < today) return 'red';
        if (taskDate.toDateString() === today.toDateString()) return 'green';
        return 'yellow';
    }
});