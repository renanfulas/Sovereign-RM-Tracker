(function() {
    var storage = window.SRM.storage;
    var entries = window.SRM.entries;
    var coachEngine = window.SRM.coachEngine;
    var uiForms = window.SRM.uiForms;
    var uiRenderers = window.SRM.uiRenderers;
    var formatters = window.SRM.formatters;

    var dom = {
        loginPage: document.getElementById('login-page'),
        registerPage: document.getElementById('register-page'),
        appPage: document.getElementById('app-page'),
        showRegisterLink: document.getElementById('show-register-link'),
        showLoginLink: document.getElementById('show-login-link'),
        loginButton: document.getElementById('login-button'),
        registerButton: document.getElementById('register-button'),
        logoutButton: document.getElementById('logout-button'),
        entryForm: document.getElementById('entry-form'),
        addCard: document.querySelector('.add-card'),
        exerciseNameField: document.getElementById('exercise-name'),
        rmValueField: document.getElementById('rm-value'),
        repsValueField: document.getElementById('reps-value'),
        formModeLabel: document.getElementById('form-mode-label'),
        cancelEditButton: document.getElementById('cancel-edit-button'),
        entryPreview: document.getElementById('entry-preview'),
        formFeedback: document.getElementById('form-feedback'),
        saveRmButton: document.getElementById('save-rm-button'),
        rmList: document.getElementById('rm-list'),
        insightsBoard: document.getElementById('insights-board'),
        welcomeMsg: document.getElementById('welcome-msg'),
        coachSuggestions: document.getElementById('coach-suggestions'),
        coachMessages: document.getElementById('coach-messages'),
        coachTyping: document.getElementById('coach-typing'),
        coachForm: document.getElementById('coach-form'),
        coachInput: document.getElementById('coach-input')
    };

    var state = {
        editingEntryId: null,
        feedbackTimeoutId: null,
        coachConversation: [],
        coachReplyTimeoutId: null
    };

    function setCoachTyping(isVisible) {
        dom.coachTyping.classList.toggle('hidden', !isVisible);
    }

    function pushCoachMessage(role, content) {
        state.coachConversation.push({
            id: 'coach-' + Date.now() + '-' + Math.random().toString(16).slice(2, 8),
            role: role,
            content: content,
            createdAt: new Date().toISOString()
        });

        storage.persistCoachConversation(state.coachConversation);
        uiRenderers.renderCoachConversation(dom.coachMessages, state.coachConversation);
    }

    function ensureCoachWelcome(user) {
        var snapshot;
        var welcomeMessage;

        if (state.coachConversation.length) {
            uiRenderers.renderCoachConversation(dom.coachMessages, state.coachConversation);
            return;
        }

        snapshot = coachEngine.getCoachSnapshot(user);
        welcomeMessage = snapshot
            ? 'Estou olhando seus registros. Posso te ajudar a montar treino, sugerir carga com base no 1RM, revisar sua evolucao e apontar ajustes mais seguros para progredir.'
            : 'Estou pronto para te ajudar a montar uma base de treino segura. Assim que voce registrar exercicios e cargas, eu consigo personalizar melhor as respostas.';

        pushCoachMessage('assistant', welcomeMessage);
    }

    function refreshCoachPanel(user) {
        if (!user) {
            state.coachConversation = [];
            dom.coachMessages.innerHTML = '';
            setCoachTyping(false);
            return;
        }

        state.coachConversation = storage.loadCoachConversation();
        ensureCoachWelcome(user);
    }

    function requestCoachReply(prompt) {
        var user = entries.getCurrentUserData();

        if (state.coachReplyTimeoutId) {
            clearTimeout(state.coachReplyTimeoutId);
        }

        setCoachTyping(true);
        state.coachReplyTimeoutId = setTimeout(function() {
            var reply = coachEngine.generateCoachReply(user, prompt);
            setCoachTyping(false);
            pushCoachMessage('assistant', reply);
        }, 520);
    }

    function bindSynchronizedCards() {
        var isSyncing = false;

        document.addEventListener('toggle', function(event) {
            var target = event.target;
            var syncGroup;
            var groupCards;

            if (isSyncing || !target.matches('details[data-sync-group]')) {
                return;
            }

            syncGroup = target.getAttribute('data-sync-group');

            if (!syncGroup) {
                return;
            }

            groupCards = document.querySelectorAll('details[data-sync-group="' + syncGroup + '"]');
            isSyncing = true;

            groupCards.forEach(function(card) {
                card.open = target.open;
            });

            isSyncing = false;
        }, true);
    }

    function refreshAppView() {
        var user = entries.getCurrentUserData();

        if (!user) {
            return;
        }

        entries.persistCurrentUser(user);
        dom.welcomeMsg.textContent = 'RMs de ' + user.username;
        uiRenderers.renderInsightsBoard(user, dom.insightsBoard);
        refreshCoachPanel(user);
        uiRenderers.renderRmList(user, dom.rmList);
    }

    dom.showRegisterLink.addEventListener('click', function(event) {
        event.preventDefault();
        dom.loginPage.classList.remove('active');
        dom.loginPage.classList.add('hidden');
        dom.registerPage.classList.remove('hidden');
        dom.registerPage.classList.add('active');
    });

    dom.showLoginLink.addEventListener('click', function(event) {
        event.preventDefault();
        dom.registerPage.classList.remove('active');
        dom.registerPage.classList.add('hidden');
        dom.loginPage.classList.remove('hidden');
        dom.loginPage.classList.add('active');
    });

    dom.registerButton.addEventListener('click', function() {
        var username = document.getElementById('register-username').value.trim();
        var email = document.getElementById('register-email').value.trim();
        var password = document.getElementById('register-password').value;
        var passwordRegex = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}$/;
        var users;
        var existingUser;

        if (!passwordRegex.test(password)) {
            alert('A senha deve ter no minimo 8 caracteres, com 1 letra maiuscula, 1 numero e 1 caractere especial.');
            return;
        }

        if (!username || !email || !password) {
            alert('Preencha todos os campos.');
            return;
        }

        users = storage.getUsers();
        existingUser = users.find(function(user) {
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

        storage.saveUsers(users);
        storage.setLoggedInUsername(username);
        dom.registerPage.classList.remove('active');
        dom.registerPage.classList.add('hidden');
        dom.appPage.classList.remove('hidden');
        dom.appPage.classList.add('active');
        refreshAppView();
    });

    dom.loginButton.addEventListener('click', function() {
        var username = document.getElementById('login-username').value.trim().toLowerCase();
        var password = document.getElementById('login-password').value;
        var users = storage.getUsers();
        var user = users.find(function(item) {
            return (
                item.username.trim().toLowerCase() === username ||
                item.email.trim().toLowerCase() === username
            ) && item.password === password;
        });

        if (!user) {
            alert('Usuario ou senha invalidos.');
            return;
        }

        storage.setLoggedInUsername(user.username);
        dom.loginPage.classList.remove('active');
        dom.loginPage.classList.add('hidden');
        dom.appPage.classList.remove('hidden');
        dom.appPage.classList.add('active');
        refreshAppView();
    });

    dom.logoutButton.addEventListener('click', function() {
        storage.clearLoggedInUsername();
        dom.appPage.classList.remove('active');
        dom.appPage.classList.add('hidden');
        dom.loginPage.classList.remove('hidden');
        dom.loginPage.classList.add('active');
        dom.rmList.innerHTML = '';
        dom.insightsBoard.innerHTML = '';
        state.coachConversation = [];
        dom.coachMessages.innerHTML = '';
        setCoachTyping(false);
        dom.welcomeMsg.textContent = 'Meus RMs';
        uiForms.resetEntryForm(dom, state);
    });

    dom.entryForm.addEventListener('submit', function(event) {
        var loggedInUser;
        var user;
        var entryData;
        var entryToUpdate;

        event.preventDefault();
        loggedInUser = storage.getLoggedInUsername();

        if (!loggedInUser) {
            uiForms.setFormFeedback(dom, state, 'Faca login para salvar registros.', 'error');
            return;
        }

        user = entries.getCurrentUserData();

        if (!user) {
            uiForms.setFormFeedback(dom, state, 'Usuario nao encontrado.', 'error');
            return;
        }

        entryData = uiForms.validateEntryForm(dom, state);

        if (!entryData) {
            return;
        }

        if (state.editingEntryId) {
            entryToUpdate = entries.getEntryById(user, state.editingEntryId);

            if (!entryToUpdate) {
                uiForms.setFormFeedback(dom, state, 'O registro em edicao nao foi encontrado.', 'error');
                return;
            }

            entryToUpdate.exercise = entryData.exercise;
            entryToUpdate.load = entryData.load;
            entryToUpdate.reps = entryData.reps;
            entryToUpdate.oneRm = entryData.oneRm;
            entryToUpdate.entryType = entryData.entryType;

            entries.persistCurrentUser(user);
            refreshAppView();
            uiForms.resetEntryForm(dom, state, { keepFeedback: true });
            uiForms.setFormFeedback(dom, state, 'Registro atualizado com sucesso.', 'success');
            dom.exerciseNameField.focus();
            return;
        }

        user.rms.push({
            id: 'entry-' + Date.now(),
            exercise: entryData.exercise,
            load: entryData.load,
            reps: entryData.reps,
            oneRm: entryData.oneRm,
            entryType: entryData.entryType,
            createdAt: new Date().toISOString()
        });

        entries.persistCurrentUser(user);
        refreshAppView();
        uiForms.resetEntryForm(dom, state, { keepFeedback: true });
        uiForms.setFormFeedback(dom, state, 'Registro salvo com sucesso.', 'success');
        dom.exerciseNameField.focus();
    });

    dom.cancelEditButton.addEventListener('click', function() {
        uiForms.resetEntryForm(dom, state, { keepFeedback: true });
        uiForms.setFormFeedback(dom, state, 'Edicao cancelada. O formulario voltou para novo registro.', 'info');
        dom.exerciseNameField.focus();
    });

    [dom.exerciseNameField, dom.rmValueField, dom.repsValueField].forEach(function(field) {
        field.addEventListener('input', function() {
            uiForms.updateEntryPreview(dom);

            if (dom.formFeedback.classList.contains('is-error')) {
                uiForms.setFormFeedback(dom, state, '', 'info');
            }
        });
    });

    dom.rmList.addEventListener('click', function(event) {
        var actionButton = event.target.closest('[data-action]');
        var action;
        var entryId;
        var user;
        var entry;
        var shouldDelete;

        if (!actionButton) {
            return;
        }

        action = actionButton.dataset.action;
        entryId = actionButton.dataset.entryId;
        user = entries.getCurrentUserData();

        if (!user || !entryId) {
            return;
        }

        if (action === 'edit-entry') {
            uiForms.startEditingEntry(dom, state, user, entryId);
            return;
        }

        if (action === 'delete-entry') {
            entry = entries.getEntryById(user, entryId);

            if (!entry) {
                uiForms.setFormFeedback(dom, state, 'Nao foi possivel localizar o registro para exclusao.', 'error');
                return;
            }

            shouldDelete = window.confirm('Excluir o registro de ' + entry.exercise + ' com ' + formatters.formatKg(entry.load) + ' x ' + entry.reps + ' reps?');

            if (!shouldDelete) {
                return;
            }

            user.rms = user.rms.filter(function(item) {
                return item.id !== entryId;
            });

            entries.persistCurrentUser(user);
            refreshAppView();

            if (state.editingEntryId === entryId) {
                uiForms.resetEntryForm(dom, state, { keepFeedback: true });
            }

            uiForms.setFormFeedback(dom, state, 'Registro excluido com sucesso.', 'success');
        }
    });

    dom.coachSuggestions.addEventListener('click', function(event) {
        var suggestionButton = event.target.closest('[data-prompt]');

        if (!suggestionButton) {
            return;
        }

        dom.coachInput.value = suggestionButton.dataset.prompt;
        dom.coachInput.focus();
    });

    dom.coachForm.addEventListener('submit', function(event) {
        var prompt;

        event.preventDefault();
        prompt = dom.coachInput.value.trim();

        if (!prompt) {
            dom.coachInput.focus();
            return;
        }

        pushCoachMessage('user', prompt);
        dom.coachInput.value = '';
        requestCoachReply(prompt);
    });

    (function initApp() {
        var loggedInUser = storage.getLoggedInUsername();

        bindSynchronizedCards();
        uiForms.updateEntryPreview(dom);

        if (loggedInUser) {
            dom.loginPage.classList.remove('active');
            dom.loginPage.classList.add('hidden');
            dom.registerPage.classList.remove('active');
            dom.registerPage.classList.add('hidden');
            dom.appPage.classList.remove('hidden');
            dom.appPage.classList.add('active');
            refreshAppView();
        }
    })();
})();