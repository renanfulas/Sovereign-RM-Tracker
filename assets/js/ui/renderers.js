window.SRM = window.SRM || {};

window.SRM.uiRenderers = (function() {
    var entries = window.SRM.entries;
    var formatters = window.SRM.formatters;
    var metrics = window.SRM.metrics;

    function renderCollapsibleCard(className, summaryHtml, bodyHtml, isOpen, syncGroup) {
        var syncAttribute = syncGroup ? ' data-sync-group="' + syncGroup + '"' : '';

        return '<details class="' + className + ' collapsible-card"' + syncAttribute + (isOpen ? ' open' : '') + '>' +
            '<summary class="collapsible-summary">' + summaryHtml + '</summary>' +
            '<div class="collapsible-body">' + bodyHtml + '</div>' +
        '</details>';
    }

    function renderGroupedInsightCard(className, summaryHtml, bodyHtml, syncGroup) {
        return renderCollapsibleCard(className + ' no-indicator-card', summaryHtml, bodyHtml, false, syncGroup);
    }

    function renderEvolutionChart(entriesList) {
        var orderedEntries = entriesList.slice().sort(function(a, b) {
            return new Date(a.createdAt) - new Date(b.createdAt);
        });
        var chartWidth = 320;
        var chartHeight = 168;
        var padding = 18;
        var values = orderedEntries.map(function(entry) {
            return entry.oneRm;
        });
        var maxValue = Math.max.apply(null, values);
        var minValue = Math.min.apply(null, values);
        var range = maxValue - minValue || Math.max(1, maxValue);
        var points = orderedEntries.map(function(entry, index) {
            var x = orderedEntries.length === 1
                ? chartWidth / 2
                : padding + (index * (chartWidth - padding * 2)) / (orderedEntries.length - 1);
            var y = chartHeight - padding - ((entry.oneRm - minValue) / range) * (chartHeight - padding * 2);

            return {
                x: formatters.roundToOne(x),
                y: formatters.roundToOne(y),
                label: formatters.formatKg(entry.oneRm) + ' em ' + formatters.formatDate(entry.createdAt)
            };
        });
        var linePoints = points.map(function(point) {
            return point.x + ',' + point.y;
        }).join(' ');
        var gridLines = [0, 0.5, 1].map(function(step) {
            var y = formatters.roundToOne(padding + step * (chartHeight - padding * 2));
            return '<line class="chart-grid" x1="' + padding + '" y1="' + y + '" x2="' + (chartWidth - padding) + '" y2="' + y + '"></line>';
        }).join('');
        var pointDots = points.map(function(point, index) {
            var latestClass = index === points.length - 1 ? ' is-latest' : '';
            return '<circle class="chart-point' + latestClass + '" cx="' + point.x + '" cy="' + point.y + '" r="5">' +
                '<title>' + formatters.escapeHtml(point.label) + '</title>' +
            '</circle>';
        }).join('');

        return '<div class="chart-panel">' +
            '<div class="chart-head">' +
                '<div>' +
                    '<strong>Evolucao do exercicio</strong>' +
                    '<span>Linha baseada no 1RM registrado em cada data</span>' +
                '</div>' +
                '<span>' + orderedEntries.length + ' pontos no historico</span>' +
            '</div>' +
            '<div class="chart-shell">' +
                '<svg class="progress-chart" viewBox="0 0 ' + chartWidth + ' ' + chartHeight + '" role="img" aria-label="Grafico de evolucao do exercicio">' +
                    gridLines +
                    '<polyline class="chart-line" points="' + linePoints + '"></polyline>' +
                    pointDots +
                '</svg>' +
                '<div class="chart-axis">' +
                    '<span>' + formatters.formatDate(orderedEntries[0].createdAt) + '</span>' +
                    '<span>' + formatters.formatDate(orderedEntries[orderedEntries.length - 1].createdAt) + '</span>' +
                '</div>' +
                '<div class="chart-note">Faixa observada: ' + formatters.formatKg(minValue) + ' ate ' + formatters.formatKg(maxValue) + '.</div>' +
            '</div>' +
        '</div>';
    }

    function renderHistoryList(entriesList) {
        var recentEntries = entriesList.slice().reverse().slice(0, 4);

        return recentEntries.map(function(entry) {
            var modeLabel = entry.entryType === 'estimado' ? '1RM estimado' : '1RM direto';

            return '<li class="history-item">' +
                '<div class="history-main">' +
                    '<div>' +
                        '<strong>' + formatters.formatKg(entry.oneRm) + '</strong>' +
                        '<span>' + formatters.formatKg(entry.load) + ' x ' + entry.reps + ' reps</span>' +
                    '</div>' +
                    '<div class="history-actions">' +
                        '<button type="button" class="history-action" data-action="edit-entry" data-entry-id="' + entry.id + '">Editar</button>' +
                        '<button type="button" class="history-action history-action-danger" data-action="delete-entry" data-entry-id="' + entry.id + '">Excluir</button>' +
                    '</div>' +
                '</div>' +
                '<div class="history-meta">' +
                    '<span>' + modeLabel + '</span>' +
                    '<span>' + formatters.formatDate(entry.createdAt) + ' ' + formatters.formatTime(entry.createdAt) + '</span>' +
                '</div>' +
            '</li>';
        }).join('');
    }

    function renderExerciseCard(group) {
        var exerciseMetrics = metrics.getExerciseMetrics(group.entries);
        var progressMessage = metrics.buildProgressMessage(group.exercise, exerciseMetrics);
        var latestComparison = metrics.buildLatestComparison(exerciseMetrics);
        var currentBadge = exerciseMetrics.latest.entryType === 'estimado' ? 'Estimado por repeticoes' : '1RM direto';
        var safeExercise = formatters.escapeHtml(group.exercise);
        var bestBadge = exerciseMetrics.latestIsPr
            ? '<span class="pill pill-pr">Novo PR</span>'
            : '<span class="pill">Melhor PR: ' + formatters.formatKg(exerciseMetrics.best.oneRm) + '</span>';

        return '<li class="rm-item">' +
            '<details class="rm-card" open>' +
                '<summary class="rm-header">' +
                    '<div>' +
                        '<h3 class="exercise-title">' + safeExercise + '</h3>' +
                        '<div class="exercise-badges">' +
                            '<span class="rm-value">' + formatters.formatKg(exerciseMetrics.latest.oneRm) + '</span>' +
                            '<span class="pill">' + currentBadge + '</span>' +
                            bestBadge +
                        '</div>' +
                    '</div>' +
                    '<div class="rm-date-time">' +
                        '<span class="rm-date">' + formatters.formatDate(exerciseMetrics.latest.createdAt) + '</span>' +
                        '<span class="rm-time">' + formatters.formatTime(exerciseMetrics.latest.createdAt) + '</span>' +
                    '</div>' +
                '</summary>' +
                '<div class="rm-calculator">' +
                    '<p class="progress-copy">' + formatters.escapeHtml(progressMessage) + '</p>' +
                    '<p class="comparison-copy">' + formatters.escapeHtml(latestComparison) + '</p>' +
                    renderEvolutionChart(group.entries) +
                    '<div class="calc-caption">Carga sugerida por percentual do 1RM atual</div>' +
                    '<input type="range" class="percentage-slider" min="50" max="100" step="5" value="70" data-onerm="' + exerciseMetrics.latest.oneRm + '" data-target="' + group.key + '">' +
                    '<div class="calc-result">' +
                        '<div class="percent-display" id="percent-' + group.key + '">70%</div>' +
                        '<div class="weight-display" id="weight-' + group.key + '">' + formatters.formatKg(formatters.roundToOne(exerciseMetrics.latest.oneRm * 0.7)) + '</div>' +
                    '</div>' +
                    '<div class="history-block">' +
                        '<div class="history-head">' +
                            '<strong>Historico recente</strong>' +
                            '<span>' + exerciseMetrics.totalEntries + ' registros</span>' +
                        '</div>' +
                        '<ul class="history-list">' + renderHistoryList(group.entries) + '</ul>' +
                    '</div>' +
                '</div>' +
            '</details>' +
        '</li>';
    }

    function renderInsightsBoard(user, insightsBoard) {
        if (!user || !user.rms.length) {
            insightsBoard.innerHTML = '<section class="empty-panel">' +
                '<h3>Seu painel ainda esta vazio</h3>' +
                '<p>Registre o primeiro exercicio para liberar comparacoes entre datas, 1RM estimado e mural de PRs.</p>' +
            '</section>';
            return;
        }

        var groups = entries.groupEntriesByExercise(user.rms);
        var metricsList = groups.map(function(group) {
            return {
                exercise: group.exercise,
                metrics: metrics.getExerciseMetrics(group.entries)
            };
        });
        var bestOverall = metricsList.slice().sort(function(a, b) {
            return b.metrics.best.oneRm - a.metrics.best.oneRm;
        })[0];
        var mostImproved = metricsList
            .filter(function(item) {
                return item.metrics.totalEntries > 1;
            })
            .sort(function(a, b) {
                return b.metrics.deltaFromFirst - a.metrics.deltaFromFirst;
            })[0];
        var prFeed = metricsList
            .filter(function(item) {
                return item.metrics.latestIsPr && item.metrics.totalEntries > 1;
            })
            .sort(function(a, b) {
                return new Date(b.metrics.latest.createdAt) - new Date(a.metrics.latest.createdAt);
            })
            .slice(0, 5);
        var rankingItems = metricsList
            .slice()
            .sort(function(a, b) {
                return b.metrics.best.oneRm - a.metrics.best.oneRm;
            })
            .slice(0, 5)
            .map(function(item, index) {
                return '<li>' +
                    '<span>' + (index + 1) + '. ' + item.exercise + '</span>' +
                    '<strong>' + formatters.formatKg(item.metrics.best.oneRm) + '</strong>' +
                '</li>';
            }).join('');
        var prItems = prFeed.length
            ? prFeed.map(function(item) {
                return '<li>' +
                    '<strong>' + item.exercise + '</strong>' +
                    '<span>Bateu PR com ' + formatters.formatKg(item.metrics.latest.oneRm) + ' em ' + formatters.formatDate(item.metrics.latest.createdAt) + '.</span>' +
                '</li>';
            }).join('')
            : '<li><span>Nenhum PR novo ainda. Assim que um exercicio superar a marca anterior, ele aparece aqui.</span></li>';
        var biggestJump = mostImproved
            ? mostImproved.exercise + ' subiu ' + formatters.formatKg(mostImproved.metrics.deltaFromFirst) + ' em ' + mostImproved.metrics.daysFromFirst + ' dias.'
            : 'Registre o mesmo exercicio mais de uma vez para destravar a comparacao de evolucao.';

        insightsBoard.innerHTML =
            '<section class="dashboard-grid">' +
                renderCollapsibleCard(
                    'metric-card',
                    '<div><span class="metric-label">Exercicios medidos</span><span class="metric-value">' + groups.length + '</span></div>',
                    '<p>Historico agrupado por exercicio, e nao mais um unico RM isolado.</p>',
                    false,
                    'metrics-row'
                ) +
                renderCollapsibleCard(
                    'metric-card',
                    '<div><span class="metric-label">Total de registros</span><span class="metric-value">' + user.rms.length + '</span></div>',
                    '<p>Cada novo teste fortalece a leitura da sua evolucao.</p>',
                    false,
                    'metrics-row'
                ) +
                renderCollapsibleCard(
                    'metric-card',
                    '<div><span class="metric-label">Maior PR atual</span><span class="metric-value">' + formatters.formatKg(bestOverall.metrics.best.oneRm) + '</span></div>',
                    '<p>' + bestOverall.exercise + ' lidera o mural interno de performance.</p>',
                    false,
                    'metrics-row'
                ) +
            '</section>' +
            '<section class="insight-grid">' +
                renderGroupedInsightCard(
                    'insight-card insight-callout',
                    '<div><span class="metric-label">Comparacao entre datas</span><h3>Comparacao entre datas</h3></div>',
                    '<h3>' + biggestJump + '</h3>',
                    'insights-row'
                ) +
                renderGroupedInsightCard(
                    'insight-card',
                    '<div class="insight-head"><h3>Ranking interno</h3><span>Top PRs</span></div>',
                    '<ol class="ranking-list">' + rankingItems + '</ol>',
                    'insights-row'
                ) +
                renderGroupedInsightCard(
                    'insight-card mural-card',
                    '<div class="insight-head"><h3>Mural de PRs</h3><span>Ultimas marcas batidas</span></div>',
                    '<ul class="feed-list">' + prItems + '</ul>',
                    'insights-row'
                ) +
            '</section>';
    }

    function bindSliderEvents() {
        var sliders = document.querySelectorAll('.percentage-slider');

        sliders.forEach(function(slider) {
            var oneRm = Number(slider.dataset.onerm);
            var target = slider.dataset.target;
            var percentDisplay = document.getElementById('percent-' + target);
            var weightDisplay = document.getElementById('weight-' + target);

            function updateWeight() {
                var percent = Number(slider.value);
                var weight = formatters.roundToOne((oneRm * percent) / 100);
                percentDisplay.textContent = percent + '%';
                weightDisplay.textContent = formatters.formatKg(weight);
            }

            slider.addEventListener('input', updateWeight);
            updateWeight();
        });
    }

    function renderRmList(user, rmList) {
        if (!user || !user.rms.length) {
            rmList.innerHTML = '';
            return;
        }

        var groups = entries.groupEntriesByExercise(user.rms);
        rmList.innerHTML = groups.map(renderExerciseCard).join('');
        bindSliderEvents();
    }

    function renderCoachConversation(coachMessages, conversation) {
        if (!conversation.length) {
            coachMessages.innerHTML = '';
            return;
        }

        coachMessages.innerHTML = conversation.map(function(message) {
            var roleClass = message.role === 'user' ? 'coach-message-user' : 'coach-message-assistant';
            var roleLabel = message.role === 'user' ? 'Voce' : 'Coach IA';

            return '<article class="coach-message ' + roleClass + '">' +
                '<span class="coach-message-meta">' + roleLabel + ' • ' + formatters.formatCoachTime(message.createdAt) + '</span>' +
                '<div class="coach-bubble">' + formatters.escapeHtml(message.content).replace(/\n/g, '<br>') + '</div>' +
            '</article>';
        }).join('');

        coachMessages.scrollTop = coachMessages.scrollHeight;
    }

    return {
        renderInsightsBoard: renderInsightsBoard,
        renderRmList: renderRmList,
        renderCoachConversation: renderCoachConversation
    };
})();