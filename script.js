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
const insightsBoard = document.getElementById('insights-board');

function getUsers() {
    return JSON.parse(localStorage.getItem('users')) || [];
}

function saveUsers(users) {
    localStorage.setItem('users', JSON.stringify(users));
}

function getLoggedInUsername() {
    return sessionStorage.getItem('loggedInUser');
}

function setLoggedInUsername(username) {
    sessionStorage.setItem('loggedInUser', username);
}

function clearLoggedInUsername() {
    sessionStorage.removeItem('loggedInUser');
}

function roundToOne(value) {
    return Math.round(Number(value) * 10) / 10;
}

function formatKg(value) {
    const numericValue = Number(value) || 0;
    const hasDecimal = Math.abs(numericValue % 1) > 0;

    return numericValue.toLocaleString('pt-BR', {
        minimumFractionDigits: hasDecimal ? 1 : 0,
        maximumFractionDigits: 1
    }) + ' kg';
}

function formatDate(dateValue) {
    return new Date(dateValue).toLocaleDateString('pt-BR');
}

function formatTime(dateValue) {
    return new Date(dateValue).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

function daysBetween(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diff = Math.abs(end - start);

    return Math.max(1, Math.round(diff / 86400000));
}

function slugifyExerciseName(name) {
    return String(name || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
}

function titleCaseExercise(name) {
    return String(name || '')
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/\b\w/g, function(letter) {
            return letter.toUpperCase();
        });
}

function estimateOneRm(load, reps) {
    if (reps <= 1) {
        return roundToOne(load);
    }

    return roundToOne(load * (1 + reps / 30));
}

function parseLegacyCreatedAt(entry) {
    if (entry.createdAt) {
        return entry.createdAt;
    }

    if (entry.date) {
        const dateParts = String(entry.date).split('/');
        const timeParts = String(entry.time || '00:00').split(':');

        if (dateParts.length === 3) {
            const day = Number(dateParts[0]);
            const month = Number(dateParts[1]) - 1;
            const year = Number(dateParts[2]);
            const hours = Number(timeParts[0] || 0);
            const minutes = Number(timeParts[1] || 0);

            return new Date(year, month, day, hours, minutes).toISOString();
        }
    }

    return new Date().toISOString();
}

function migrateUser(user) {
    if (!user) {
        return user;
    }

    if (!Array.isArray(user.rms)) {
        user.rms = [];
    }

    user.rms = user.rms
        .map(function(entry, index) {
            const exercise = titleCaseExercise(entry.exercise || '');
            const load = Number(entry.load || entry.value || 0);
            const reps = Math.max(1, Number(entry.reps || 1));
            const createdAt = parseLegacyCreatedAt(entry);
            const oneRm = Number(entry.oneRm) || estimateOneRm(load, reps);
            const entryType = entry.entryType || (reps > 1 ? 'estimado' : 'direto');

            return {
                id: entry.id || 'entry-' + new Date(createdAt).getTime() + '-' + index,
                exercise: exercise,
                load: roundToOne(load),
                reps: reps,
                oneRm: roundToOne(oneRm),
                entryType: entryType,
                createdAt: createdAt
            };
        })
        .filter(function(entry) {
            return entry.exercise && entry.load > 0;
        });

    return user;
}

function getCurrentUserData() {
    const loggedInUser = getLoggedInUsername();
    const users = getUsers();
    const user = users.find(function(item) {
        return item.username === loggedInUser;
    });

    if (!user) {
        return null;
    }

    return migrateUser(user);
}

function persistCurrentUser(user) {
    const users = getUsers();
    const userIndex = users.findIndex(function(item) {
        return item.username === user.username;
    });

    if (userIndex >= 0) {
        users[userIndex] = user;
        saveUsers(users);
    }
}

function groupEntriesByExercise(entries) {
    const groups = {};

    entries.forEach(function(entry) {
        const key = slugifyExerciseName(entry.exercise);

        if (!groups[key]) {
            groups[key] = {
                key: key,
                exercise: entry.exercise,
                entries: []
            };
        }

        groups[key].entries.push(entry);
    });

    return Object.values(groups)
        .map(function(group) {
            group.entries.sort(function(a, b) {
                return new Date(a.createdAt) - new Date(b.createdAt);
            });
            return group;
        })
        .sort(function(a, b) {
            const aDate = new Date(a.entries[a.entries.length - 1].createdAt);
            const bDate = new Date(b.entries[b.entries.length - 1].createdAt);
            return bDate - aDate;
        });
}

function getExerciseMetrics(entries) {
    const orderedEntries = entries.slice().sort(function(a, b) {
        return new Date(a.createdAt) - new Date(b.createdAt);
    });

    const first = orderedEntries[0];
    const latest = orderedEntries[orderedEntries.length - 1];
    const previous = orderedEntries.length > 1 ? orderedEntries[orderedEntries.length - 2] : null;
    const best = orderedEntries.reduce(function(currentBest, entry) {
        return entry.oneRm > currentBest.oneRm ? entry : currentBest;
    }, orderedEntries[0]);

    const deltaFromFirst = roundToOne(latest.oneRm - first.oneRm);
    const deltaFromPrevious = previous ? roundToOne(latest.oneRm - previous.oneRm) : 0;
    const daysFromFirst = orderedEntries.length > 1 ? daysBetween(first.createdAt, latest.createdAt) : 0;
    const daysFromPrevious = previous ? daysBetween(previous.createdAt, latest.createdAt) : 0;
    const latestIsPr = latest.id === best.id;

    return {
        first: first,
        latest: latest,
        previous: previous,
        best: best,
        deltaFromFirst: deltaFromFirst,
        deltaFromPrevious: deltaFromPrevious,
        daysFromFirst: daysFromFirst,
        daysFromPrevious: daysFromPrevious,
        latestIsPr: latestIsPr,
        totalEntries: orderedEntries.length
    };
}

function buildProgressMessage(exercise, metrics) {
    if (metrics.totalEntries === 1) {
        return 'Primeiro registro salvo. Agora voce tem um ponto de partida claro para evoluir.';
    }

    if (metrics.deltaFromFirst > 0) {
        return exercise + ' subiu ' + formatKg(metrics.deltaFromFirst) + ' em ' + metrics.daysFromFirst + ' dias.';
    }

    if (metrics.deltaFromFirst < 0) {
        return exercise + ' oscilou ' + formatKg(Math.abs(metrics.deltaFromFirst)) + ' em ' + metrics.daysFromFirst + ' dias.';
    }

    return exercise + ' manteve o mesmo nivel entre o primeiro e o ultimo registro.';
}

function buildLatestComparison(metrics) {
    if (!metrics.previous) {
        return 'Sem comparacao anterior por enquanto.';
    }

    if (metrics.deltaFromPrevious > 0) {
        return 'Ultimo teste: +' + formatKg(metrics.deltaFromPrevious) + ' em ' + metrics.daysFromPrevious + ' dias.';
    }

    if (metrics.deltaFromPrevious < 0) {
        return 'Ultimo teste: -' + formatKg(Math.abs(metrics.deltaFromPrevious)) + ' em ' + metrics.daysFromPrevious + ' dias.';
    }

    return 'Ultimo teste manteve a mesma marca do registro anterior.';
}

function renderSparkline(entries) {
    const maxValue = Math.max.apply(null, entries.map(function(entry) {
        return entry.oneRm;
    }));

    return entries.map(function(entry, index) {
        const height = Math.max(18, Math.round((entry.oneRm / maxValue) * 78));
        const latestClass = index === entries.length - 1 ? ' is-latest' : '';

        return '<span class="spark-bar' + latestClass + '" style="height:' + height + 'px" title="' + formatKg(entry.oneRm) + ' em ' + formatDate(entry.createdAt) + '"></span>';
    }).join('');
}

function renderHistoryList(entries) {
    const recentEntries = entries.slice().reverse().slice(0, 4);

    return recentEntries.map(function(entry) {
        const modeLabel = entry.entryType === 'estimado' ? '1RM estimado' : '1RM direto';

        return '<li class="history-item">' +
            '<div>' +
                '<strong>' + formatKg(entry.oneRm) + '</strong>' +
                '<span>' + formatKg(entry.load) + ' x ' + entry.reps + ' reps</span>' +
            '</div>' +
            '<div class="history-meta">' +
                '<span>' + modeLabel + '</span>' +
                '<span>' + formatDate(entry.createdAt) + ' ' + formatTime(entry.createdAt) + '</span>' +
            '</div>' +
        '</li>';
    }).join('');
}

function renderExerciseCard(group) {
    const metrics = getExerciseMetrics(group.entries);
    const progressMessage = buildProgressMessage(group.exercise, metrics);
    const latestComparison = buildLatestComparison(metrics);
    const currentBadge = metrics.latest.entryType === 'estimado' ? 'Estimado por repeticoes' : '1RM direto';
    const bestBadge = metrics.latestIsPr
        ? '<span class="pill pill-pr">Novo PR</span>'
        : '<span class="pill">Melhor PR: ' + formatKg(metrics.best.oneRm) + '</span>';

    return '<li class="rm-item">' +
        '<details class="rm-card" open>' +
            '<summary class="rm-header">' +
                '<div>' +
                    '<h3 class="exercise-title">' + group.exercise + '</h3>' +
                    '<div class="exercise-badges">' +
                        '<span class="rm-value">' + formatKg(metrics.latest.oneRm) + '</span>' +
                        '<span class="pill">' + currentBadge + '</span>' +
                        bestBadge +
                    '</div>' +
                '</div>' +
                '<div class="rm-date-time">' +
                    '<span class="rm-date">' + formatDate(metrics.latest.createdAt) + '</span>' +
                    '<span class="rm-time">' + formatTime(metrics.latest.createdAt) + '</span>' +
                '</div>' +
            '</summary>' +
            '<div class="rm-calculator">' +
                '<p class="progress-copy">' + progressMessage + '</p>' +
                '<p class="comparison-copy">' + latestComparison + '</p>' +
                '<div class="sparkline-wrap">' +
                    '<div class="sparkline">' + renderSparkline(group.entries) + '</div>' +
                '</div>' +
                '<div class="calc-caption">Carga sugerida por percentual do 1RM atual</div>' +
                '<input type="range" class="percentage-slider" min="50" max="100" step="5" value="70" data-onerm="' + metrics.latest.oneRm + '" data-target="' + group.key + '">' +
                '<div class="calc-result">' +
                    '<div class="percent-display" id="percent-' + group.key + '">70%</div>' +
                    '<div class="weight-display" id="weight-' + group.key + '">' + formatKg(roundToOne(metrics.latest.oneRm * 0.7)) + '</div>' +
                '</div>' +
                '<div class="history-block">' +
                    '<div class="history-head">' +
                        '<strong>Historico recente</strong>' +
                        '<span>' + metrics.totalEntries + ' registros</span>' +
                    '</div>' +
                    '<ul class="history-list">' + renderHistoryList(group.entries) + '</ul>' +
                '</div>' +
            '</div>' +
        '</details>' +
    '</li>';
}

function renderInsightsBoard(user) {
    if (!user || !user.rms.length) {
        insightsBoard.innerHTML = '<section class="empty-panel">' +
            '<h3>Seu painel ainda esta vazio</h3>' +
            '<p>Registre o primeiro exercicio para liberar comparacoes entre datas, 1RM estimado e mural de PRs.</p>' +
        '</section>';
        return;
    }

    const groups = groupEntriesByExercise(user.rms);
    const metricsList = groups.map(function(group) {
        return {
            exercise: group.exercise,
            metrics: getExerciseMetrics(group.entries)
        };
    });

    const bestOverall = metricsList.slice().sort(function(a, b) {
        return b.metrics.best.oneRm - a.metrics.best.oneRm;
    })[0];

    const mostImproved = metricsList
        .filter(function(item) {
            return item.metrics.totalEntries > 1;
        })
        .sort(function(a, b) {
            return b.metrics.deltaFromFirst - a.metrics.deltaFromFirst;
        })[0];

    const prFeed = metricsList
        .filter(function(item) {
            return item.metrics.latestIsPr && item.metrics.totalEntries > 1;
        })
        .sort(function(a, b) {
            return new Date(b.metrics.latest.createdAt) - new Date(a.metrics.latest.createdAt);
        })
        .slice(0, 5);

    const rankingItems = metricsList
        .slice()
        .sort(function(a, b) {
            return b.metrics.best.oneRm - a.metrics.best.oneRm;
        })
        .slice(0, 5)
        .map(function(item, index) {
            return '<li>' +
                '<span>' + (index + 1) + '. ' + item.exercise + '</span>' +
                '<strong>' + formatKg(item.metrics.best.oneRm) + '</strong>' +
            '</li>';
        }).join('');

    const prItems = prFeed.length
        ? prFeed.map(function(item) {
            return '<li>' +
                '<strong>' + item.exercise + '</strong>' +
                '<span>Bateu PR com ' + formatKg(item.metrics.latest.oneRm) + ' em ' + formatDate(item.metrics.latest.createdAt) + '.</span>' +
            '</li>';
        }).join('')
        : '<li><span>Nenhum PR novo ainda. Assim que um exercicio superar a marca anterior, ele aparece aqui.</span></li>';

    const biggestJump = mostImproved
        ? mostImproved.exercise + ' subiu ' + formatKg(mostImproved.metrics.deltaFromFirst) + ' em ' + mostImproved.metrics.daysFromFirst + ' dias.'
        : 'Registre o mesmo exercicio mais de uma vez para destravar a comparacao de evolucao.';

    insightsBoard.innerHTML =
        '<section class="dashboard-grid">' +
            '<article class="metric-card">' +
                '<span class="metric-label">Exercicios acompanhados</span>' +
                '<strong>' + groups.length + '</strong>' +
                '<p>Historico agrupado por exercicio, e nao mais um unico RM isolado.</p>' +
            '</article>' +
            '<article class="metric-card">' +
                '<span class="metric-label">Total de registros</span>' +
                '<strong>' + user.rms.length + '</strong>' +
                '<p>Cada novo teste fortalece a leitura da sua evolucao.</p>' +
            '</article>' +
            '<article class="metric-card">' +
                '<span class="metric-label">Maior PR atual</span>' +
                '<strong>' + formatKg(bestOverall.metrics.best.oneRm) + '</strong>' +
                '<p>' + bestOverall.exercise + ' lidera o mural interno de performance.</p>' +
            '</article>' +
        '</section>' +
        '<section class="insight-grid">' +
            '<article class="insight-card insight-callout">' +
                '<span class="metric-label">Comparacao entre datas</span>' +
                '<h3>' + biggestJump + '</h3>' +
                '<p>Essa mensagem deixa a evolucao evidente para o aluno, coach ou academia.</p>' +
            '</article>' +
            '<article class="insight-card">' +
                '<div class="insight-head">' +
                    '<h3>Ranking interno</h3>' +
                    '<span>Top PRs</span>' +
                '</div>' +
                '<ol class="ranking-list">' + rankingItems + '</ol>' +
            '</article>' +
            '<article class="insight-card">' +
                '<div class="insight-head">' +
                    '<h3>Mural de PRs</h3>' +
                    '<span>Ultimas marcas batidas</span>' +
                '</div>' +
                '<ul class="feed-list">' + prItems + '</ul>' +
            '</article>' +
        '</section>';
}

function bindSliderEvents() {
    const sliders = document.querySelectorAll('.percentage-slider');

    sliders.forEach(function(slider) {
        const oneRm = Number(slider.dataset.onerm);
        const target = slider.dataset.target;
        const percentDisplay = document.getElementById('percent-' + target);
        const weightDisplay = document.getElementById('weight-' + target);

        function updateWeight() {
            const percent = Number(slider.value);
            const weight = roundToOne((oneRm * percent) / 100);
            percentDisplay.textContent = percent + '%';
            weightDisplay.textContent = formatKg(weight);
        }

        slider.addEventListener('input', updateWeight);
        updateWeight();
    });
}

function renderRmList(user) {
    if (!user || !user.rms.length) {
        rmList.innerHTML = '';
        return;
    }

    const groups = groupEntriesByExercise(user.rms);
    rmList.innerHTML = groups.map(renderExerciseCard).join('');
    bindSliderEvents();
}

function refreshAppView() {
    const user = getCurrentUserData();

    if (!user) {
        return;
    }

    persistCurrentUser(user);
    document.getElementById('welcome-msg').textContent = 'RMs de ' + user.username;
    renderInsightsBoard(user);
    renderRmList(user);
}

showRegisterLink.addEventListener('click', function(event) {
    event.preventDefault();
    loginPage.classList.remove('active');
    loginPage.classList.add('hidden');
    registerPage.classList.remove('hidden');
    registerPage.classList.add('active');
});

showLoginLink.addEventListener('click', function(event) {
    event.preventDefault();
    registerPage.classList.remove('active');
    registerPage.classList.add('hidden');
    loginPage.classList.remove('hidden');
    loginPage.classList.add('active');
});

registerButton.addEventListener('click', function() {
    const username = document.getElementById('register-username').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const passwordRegex = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}$/;

    if (!passwordRegex.test(password)) {
        alert('A senha deve ter no minimo 8 caracteres, com 1 letra maiuscula, 1 numero e 1 caractere especial.');
        return;
    }

    if (!username || !email || !password) {
        alert('Preencha todos os campos.');
        return;
    }

    const users = getUsers();
    const existingUser = users.find(function(user) {
        return user.username === username || user.email === email;
    });

    if (existingUser) {
        alert('Usuario ou e-mail ja cadastrado.');
        return;
    }

    users.push({
        username: username,
        email: email,
        password: password,
        rms: []
    });

    saveUsers(users);
    setLoggedInUsername(username);

    registerPage.classList.remove('active');
    registerPage.classList.add('hidden');
    appPage.classList.remove('hidden');
    appPage.classList.add('active');

    refreshAppView();
});

loginButton.addEventListener('click', function() {
    const username = document.getElementById('login-username').value.trim().toLowerCase();
    const password = document.getElementById('login-password').value;
    const users = getUsers();

    const user = users.find(function(item) {
        return (
            item.username.trim().toLowerCase() === username ||
            item.email.trim().toLowerCase() === username
        ) && item.password === password;
    });

    if (!user) {
        alert('Usuario ou senha invalidos.');
        return;
    }

    setLoggedInUsername(user.username);

    loginPage.classList.remove('active');
    loginPage.classList.add('hidden');
    appPage.classList.remove('hidden');
    appPage.classList.add('active');

    refreshAppView();
});

logoutButton.addEventListener('click', function() {
    clearLoggedInUsername();
    appPage.classList.remove('active');
    appPage.classList.add('hidden');
    loginPage.classList.remove('hidden');
    loginPage.classList.add('active');
    rmList.innerHTML = '';
    insightsBoard.innerHTML = '';
    document.getElementById('welcome-msg').textContent = 'Meus RMs';
});

saveRmButton.addEventListener('click', function() {
    const exerciseNameField = document.getElementById('exercise-name');
    const rmValueField = document.getElementById('rm-value');
    const repsValueField = document.getElementById('reps-value');

    const exerciseName = titleCaseExercise(exerciseNameField.value);
    const load = Number(rmValueField.value);
    const reps = Number(repsValueField.value);
    const loggedInUser = getLoggedInUsername();

    const nameRegex = /^[A-Za-zÀ-ÿ0-9\s()./-]+$/;

    if (!nameRegex.test(exerciseName) || exerciseName.length < 2) {
        alert('Use um nome valido para o exercicio.');
        return;
    }

    if (!load || load < 1 || load > 999) {
        alert('A carga deve estar entre 1 kg e 999 kg.');
        return;
    }

    if (!reps || reps < 1 || reps > 15) {
        alert('As repeticoes devem estar entre 1 e 15.');
        return;
    }

    if (!loggedInUser) {
        alert('Faca login para salvar registros.');
        return;
    }

    const user = getCurrentUserData();

    if (!user) {
        alert('Usuario nao encontrado.');
        return;
    }

    const createdAt = new Date().toISOString();
    const oneRm = estimateOneRm(load, reps);

    user.rms.push({
        id: 'entry-' + Date.now(),
        exercise: exerciseName,
        load: roundToOne(load),
        reps: reps,
        oneRm: oneRm,
        entryType: reps > 1 ? 'estimado' : 'direto',
        createdAt: createdAt
    });

    persistCurrentUser(user);
    refreshAppView();

    exerciseNameField.value = '';
    rmValueField.value = '';
    repsValueField.value = '1';
    exerciseNameField.focus();
});

(function initApp() {
    const loggedInUser = getLoggedInUsername();

    if (loggedInUser) {
        loginPage.classList.remove('active');
        loginPage.classList.add('hidden');
        registerPage.classList.remove('active');
        registerPage.classList.add('hidden');
        appPage.classList.remove('hidden');
        appPage.classList.add('active');
        refreshAppView();
    }
})();