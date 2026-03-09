// ================================
// Seleção de Elementos da Interface
// ================================

const loginPage = document.getElementById('login-page');
const registerPage = document.getElementById('register-page');
const appPage = document.getElementById('app-page');

const showRegisterLink = document.getElementById('show-register-link');
const showLoginLink = document.getElementById('show-login-link');

const loginButton = document.getElementById('login-button');
const registerButton = document.getElementById('register-button');
const logoutButton = document.getElementById('logout-button');

const saveRmButton = document.getElementById('save-rm-button');
const rmList = document.getElementById('rm-list');


// ================================
// Navegação entre páginas
// ================================

showRegisterLink.addEventListener('click', (e) => {

    e.preventDefault();

    loginPage.classList.remove('active');
    loginPage.classList.add('hidden');
    registerPage.classList.remove('hidden');
    registerPage.classList.add('active');

});

showLoginLink.addEventListener('click', (e) => {

    e.preventDefault();

    registerPage.classList.remove('active');
    registerPage.classList.add('hidden');
    loginPage.classList.remove('hidden');
    loginPage.classList.add('active');

});


// ================================
// Cadastro de Usuário
// ================================

registerButton.addEventListener('click', () => {

    const username = document.getElementById('register-username').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;

    const passwordRegex = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}$/;

    if (!passwordRegex.test(password)) {

        alert('A senha deve ter no mínimo 8 caracteres, com 1 letra maiúscula, 1 número e 1 caractere especial.');
        return;

    }

    if (username && email && password) {

        const users = JSON.parse(localStorage.getItem('users')) || [];

        const existingUser = users.find(user =>
            user.username === username || user.email === email
        );

        if (existingUser) {

            alert('Usuário ou e-mail já cadastrado.');
            return;

        }

        users.push({

            username: username,
            email: email,
            password: password,
            rms: []

        });

        localStorage.setItem('users', JSON.stringify(users));

        alert('Cadastro realizado com sucesso!');

        // Login automático após cadastro
        sessionStorage.setItem('loggedInUser', username);
        registerPage.classList.remove('active');
        registerPage.classList.add('hidden');
        appPage.classList.remove('hidden');
        appPage.classList.add('active');
        loadUserRms();

    } else {

        alert('Preencha todos os campos.');

    }

});


// ================================
// Login
// ================================

loginButton.addEventListener('click', () => {

    const username = document.getElementById('login-username').value.trim().toLowerCase();
    const password = document.getElementById('login-password').value;

    const users = JSON.parse(localStorage.getItem('users')) || [];

    const user = users.find(u =>
        (u.username.trim().toLowerCase() === username || u.email.trim().toLowerCase() === username) &&
        u.password === password
    );

    if (user) {
        sessionStorage.setItem('loggedInUser', user.username);
        loginPage.classList.remove('active');
        loginPage.classList.add('hidden');
        appPage.classList.remove('hidden');
        appPage.classList.add('active');
        loadUserRms();
    } else {
        alert('Usuário ou senha inválidos.');
    }

});


// ================================
// Logout
// ================================

logoutButton.addEventListener('click', () => {

    sessionStorage.removeItem('loggedInUser');
    appPage.classList.remove('active');
    appPage.classList.add('hidden');
    loginPage.classList.remove('hidden');
    loginPage.classList.add('active');
    rmList.innerHTML = '';

});


// ================================
// Carregar exercícios do usuário
// ================================

function loadUserRms() {

    const loggedInUser = sessionStorage.getItem('loggedInUser');

    const users = JSON.parse(localStorage.getItem('users')) || [];

    const user = users.find(u => u.username === loggedInUser);

    rmList.innerHTML = '';

    if (user && user.rms) {

        user.rms.forEach(rm => {

            displayRm(rm.exercise, rm.value, rm.date, rm.time);

        });

    }

}


// ================================
// Salvar novo RM
// ================================

saveRmButton.addEventListener('click', () => {

    const exerciseName = document.getElementById('exercise-name').value.trim();
    const rmValue = parseInt(document.getElementById('rm-value').value);

    const loggedInUser = sessionStorage.getItem('loggedInUser');

    const nameRegex = /^[A-Za-zÀ-ÿ\s]+$/;

    if (!nameRegex.test(exerciseName)) {

        alert('O nome do exercício deve conter apenas letras.');
        return;

    }

    if (rmValue > 999 || rmValue < 1) {

        alert('O RM deve estar entre 1kg e 999kg.');
        return;

    }

    if (exerciseName && rmValue && loggedInUser) {

        let users = JSON.parse(localStorage.getItem('users')) || [];

        let user = users.find(u => u.username === loggedInUser);

        if (user) {

            if (!user.rms) {

                user.rms = [];

            }

            const duplicate = user.rms.find(rm =>
                rm.exercise.toLowerCase() === exerciseName.toLowerCase()
            );

            if (duplicate) {

                alert('Este exercício já está cadastrado.');
                return;

            }

            // Adiciona data e hora
            const now = new Date();
            const dateStr = now.toLocaleDateString('pt-BR');
            const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            user.rms.push({
                exercise: exerciseName,
                value: rmValue,
                date: dateStr,
                time: timeStr
            });
            localStorage.setItem('users', JSON.stringify(users));
            displayRm(exerciseName, rmValue, dateStr, timeStr);
            document.getElementById('exercise-name').value = '';
            document.getElementById('rm-value').value = '';

        }

    } else {

        alert('Preencha o exercício e o RM.');

    }

});


// ================================
// Mostrar exercício na tela
// ================================

function displayRm(exercise, value, date, time) {

    const li = document.createElement('li');

    li.className = 'rm-item';

    li.dataset.rmValue = value;

    li.innerHTML = `
        <div class="rm-card">
            <div class="rm-header">
                <div>
                    <h3 class="exercise-title">${exercise}</h3>
                    <span class="rm-value">${value} kg (1RM)</span>
                </div>
                <div class="rm-date-time">
                    <span class="rm-date">${date ? date : ''}</span>
                    <span class="rm-time">${time ? time : ''}</span>
                </div>
            </div>
            <div class="rm-calculator hidden">
                <input 
                    type="range"
                    class="percentage-slider"
                    min="50"
                    max="100"
                    step="5"
                    value="70"
                >
                <div class="calc-result">
                    <div class="percent-display">70%</div>
                    <div class="weight-display"></div>
                </div>
            </div>
        </div>
    `;

    rmList.appendChild(li);

    const slider = li.querySelector('.percentage-slider');
    const percentDisplay = li.querySelector('.percent-display');
    const weightDisplay = li.querySelector('.weight-display');
    const calculatorDiv = li.querySelector('.rm-calculator');
    const headerDiv = li.querySelector('.rm-header');
    function updateWeight(){
        const rm = parseInt(li.dataset.rmValue);
        const percent = parseInt(slider.value);
        const weight = Math.round((rm * percent) / 100);
        percentDisplay.textContent = percent + "%";
        weightDisplay.textContent = weight + " kg";
    }

    slider.addEventListener('input', updateWeight);
    updateWeight();

    // Inicialmente minimizado
    calculatorDiv.classList.add('hidden');

    headerDiv.style.cursor = 'pointer';
    headerDiv.addEventListener('click', () => {
        calculatorDiv.classList.toggle('hidden');
    });

}


// ================================
// Delegação de eventos da lista
// ================================

rmList.addEventListener('click', (event) => {

    if (event.target.classList.contains('calculate-perc-btn')) {
        const btn = event.target;
        const item = btn.closest('.rm-item');
        const breakdownDiv = item.querySelector('.percentage-breakdown');
        const isVisible = breakdownDiv.classList.toggle('visible');
        btn.textContent = 'Tabela %';
        if (isVisible && breakdownDiv.innerHTML.trim() === '') {
            const rmValue = parseInt(item.dataset.rmValue);
            let tableHTML = `
            <table class="percentage-table">
                <thead>
                    <tr>
                        <th>%</th>
                        <th>Carga</th>
                    </tr>
                </thead>
                <tbody>
            `;
            for (let p = 50; p <= 100; p += 5) {
                const calculatedWeight = Math.round((rmValue * p) / 100);
                tableHTML += `
                    <tr>
                        <td>${p}%</td>
                        <td>${calculatedWeight} kg</td>
                    </tr>
                `;
            }
            tableHTML += `
                </tbody>
            </table>
            `;
            breakdownDiv.innerHTML = tableHTML;
        }
    }

});