// config
var API = 'https://evocation.network:3000/api/'; // API address
var defaultPool = 'rvn'; // Default Pool ID

var storedPool = localStorage.getItem('pool');
var currentPool = storedPool || defaultPool;

// private function
function _formatter(value, decimal, unit) {
    if (value === 0) {
        return '0 ' + unit;
    } else {
        var si = [
            { value: 1, symbol: "" },
            { value: 1e3, symbol: "k" },
            { value: 1e6, symbol: "M" },
            { value: 1e9, symbol: "G" },
            { value: 1e12, symbol: "T" },
            { value: 1e15, symbol: "P" },
            { value: 1e18, symbol: "E" },
            { value: 1e21, symbol: "Z" },
            { value: 1e24, symbol: "Y" },
        ];
        for (var i = si.length - 1; i > 0; i--) {
            if (value >= si[i].value) {
                break;
            }
        }
        return (value / si[i].value).toFixed(decimal).replace(/\.0+$|(\.[0-9]*[1-9])0+$/, "$1") + ' ' + si[i].symbol + unit;
    }
}

function _dateFormatter(date, format = true) {
    var date = moment.utc(date).local();

    if(format) {
        date = date.format('MMMM Do YYYY, hh:mm:ss');
    }

    return date;
}

function loadPools(renderCallback) {
    $('#poolList ul').html('');
    return $.ajax(API + 'pools')
        .done(function (data) {
            var poolList = '';
            $.each(data.pools, function (index, value) {
                if (currentPool.length === 0 && index === 0) {
                    currentPool = value.id;
                }
                if (currentPool === value.id) {
                    $('#currentPool').attr('data-id', value.id);
                    $('#currentPool span').text(value.coin.type);
                    $('#currentPool img').attr('src', 'assets/img/coins/' + value.coin.type + '.png');
                } else {
                    poolList += '<li><a href="javascript:void(0)" data-id="' + value.id + '"><img src="assets/img/coins/' + value.coin.type + '.png" style="margin-top: -4px; height: 20px;">&nbsp;<span class="big">' + value.coin.type + '</span></a></li>';
                }
            });
            if (poolList.length > 0) {
                $('#poolList ul').append(poolList);
            }
            if (data.pools.length > 1) {
                $('#poolList li a').on('click', function (event) {
                    currentPool = $(this).attr('data-id');
                    localStorage.setItem('pool', currentPool);
                    loadPools(renderCallback);
                });
            }

            if (renderCallback.has()) {
                renderCallback.fire();
            }
        })
        .fail(function () {
            $.notify({
                icon: "ti-cloud-down",
                message: "Error: No response from API.<br>(loadPools)",
            }, {
                type: 'danger',
                timer: 3000,
            });
        });
}

function loadStatsData() {
    return $.ajax(API + 'pools')
        .done(function (data) {
            $.each(data.pools, function (index, value) {
                if (currentPool === value.id) {
                    $('#poolMiners').text(_formatter(value.poolStats.connectedMiners, 0, ''));
                    $('#poolHashRate').text(_formatter(value.poolStats.poolHashrate, 5, 'H/s'));
                    $('#networkHashRate').text(_formatter(value.networkStats.networkHashrate, 5, 'H/s'));
                    $('#networkDifficulty').text(_formatter(value.networkStats.networkDifficulty, 5, ''));
                }
            });
        })
        .fail(function () {
            $.notify({
                icon: "ti-cloud-down",
                message: "Error: No response from API.<br>(loadStatsData)",
            }, {
                type: 'danger',
                timer: 3000,
            });
        });
}

function loadStatsChart() {
    return $.ajax(API + 'pools/' + currentPool + '/performance')
        .done(function (data) {
            labels = [];
            connectedMiners = [];
            networkHashRate = [];
            poolHashRate = [];
            $.each(data.stats, function (index, value) {
                if (labels.length === 0 || (labels.length + 1) % 4 === 1) {
                    labels.push(_dateFormatter(value.created, false).format('HH:mm'));
                } else {
                    labels.push('');
                }

                networkHashRate.push(value.networkHashrate);
                poolHashRate.push(value.poolHashrate);
                connectedMiners.push(value.connectedMiners);
            });
            var data = {
                labels: labels,
                series: [
                    networkHashRate,
                    poolHashRate,
                ],
            };
            var options = {
                showArea: true,
                height: "245px",
                axisX: {
                    showGrid: false,
                },
                axisY: {
                    offset: 47,
                    labelInterpolationFnc: function(value) {
                        return _formatter(value, 1, '');
                    }
                },
                lineSmooth: Chartist.Interpolation.simple({
                    divisor: 2,
                }),
            };
            var responsiveOptions = [
                ['screen and (max-width: 640px)', {
                    axisX: {
                        labelInterpolationFnc: function (value) {
                            return value[0];
                        }
                    },
                }],
            ];
            Chartist.Line('#chartStatsHashRate', data, options, responsiveOptions);
            var data = {
                labels: labels,
                series: [
                    connectedMiners,
                ],
            };
            var options = {
                height: "245px",
                axisX: {
                    showGrid: false,
                },
                lineSmooth: Chartist.Interpolation.simple({
                    divisor: 2,
                }),
            };
            var responsiveOptions = [
                ['screen and (max-width: 640px)', {
                    axisX: {
                        labelInterpolationFnc: function (value) {
                            return value[0];
                        }
                    },
                }],
            ];
            Chartist.Line('#chartStatsMiners', data, options, responsiveOptions);
        })
        .fail(function () {
            $.notify({
                icon: "ti-cloud-down",
                message: "Error: No response from API.<br>(loadStatsChart)",
            }, {
                type: 'danger',
                timer: 3000,
            });
        });
}

function loadDashboardData(walletAddress) {
    return $.ajax(API + 'pools/' + currentPool + '/miners/' + walletAddress)
        .done(function (data) {
            $('#pendingShares').text(_formatter(data.pendingShares, 0, ''));
            var workerHashRate = 0;
            if(!data.performance) {
                data.performance = {
                    workers: []
                };
            }
            $.each(data.performance.workers, function (index, value) {
                workerHashRate += value.hashrate;
            });
            
            var labels = [];
            var minerHashRate = [];
            var totalHashRate = 0;
            var avgWorkersHashRate = [];
            var avgWorkersShares = [];

            $.each(data.performanceSamples, function (index, value) {
                if (labels.length === 0 || (labels.length + 1) % 4 === 1) {
                    labels.push(_dateFormatter(value.created, false).format('HH:mm'));
                } else {
                    labels.push('');
                }

                var workerHashRate = 0;
                $.each(value.workers, function (index2, value2) {
                    workerHashRate += value2.hashrate;
                    
                    if(avgWorkersHashRate[index2] == null) {
                        avgWorkersHashRate[index2] = 0;
                    }

                    if(avgWorkersShares[index2] == null) {
                        avgWorkersShares[index2] = 0;
                    }

                    avgWorkersHashRate[index2] += value2.hashrate;
                    avgWorkersShares[index2] += value2.sharesPerSecond;
                });
                
                minerHashRate.push(workerHashRate);

                totalHashRate += workerHashRate;
            });

            var chartData = {
                labels: labels,
                series: [
                    minerHashRate,
                ],
            };
            var options = {
                showArea: true,
                height: "245px",
                axisX: {
                    showGrid: false,
                },
                axisY: {
                    offset: 47,
                    labelInterpolationFnc: function(value) {
                        return _formatter(value, 1, '');
                    }
                },
                lineSmooth: Chartist.Interpolation.simple({
                    divisor: 2,
                }),
            };
            var responsiveOptions = [
                ['screen and (max-width: 640px)', {
                    axisX: {
                        labelInterpolationFnc: function (value) {
                            return value[0];
                        }
                    },
                }],
            ];

            Chartist.Line('#chartDashboardHashRate', chartData, options, responsiveOptions);
            $('#minerAvgHashRate').text(_formatter((totalHashRate / data.performanceSamples.length) || 0, 2, 'H/s'));
            $('#minerHashRate').text(_formatter(workerHashRate, 2, 'H/s'));
            $('#pendingBalance').text(_formatter(data.pendingBalance, 5, ''));
            $('#paidBalance').text(_formatter(data.totalPaid, 5, ''));
            $('#lifetimeBalance').text(_formatter(data.pendingBalance + data.totalPaid, 5, ''));

            var workerList = '<thead><th>Name</th><th>Hash Rate</th><th>Avg(24h)</th><th>Share Rate</th><th>Avg(24h)</th></thead><tbody>';
            if (Object.keys(data.performance.workers).length > 0) {
                $.each(data.performance.workers, function (index, value) {
                    workerList += '<tr>';
                    if (index.length === 0) {
                        workerList += '<td>Unnamed</td>';
                    } else {
                        workerList += '<td>' + index + '</td>';
                    }
                    workerList += '<td>' + _formatter(value.hashrate, 5, 'H/s') + '</td>';
                    workerList += '<td>' + _formatter((avgWorkersHashRate[index] / data.performanceSamples.length) || 0, 5, 'H/s') + '</td>';
                    workerList += '<td>' + _formatter(value.sharesPerSecond, 5, 'S/s') + '</td>';
                    workerList += '<td>' + _formatter((avgWorkersShares[index] / data.performanceSamples.length) || 0, 5, 'S/s') + '</td>';
                    workerList += '</tr>';
                });
            } else {
                workerList += '<tr><td colspan="5">None</td></tr>';
            }
            workerList += '</tbody>';
            $('#workerList').html(workerList);
        })
        .fail(function () {
            $.notify({
                icon: "ti-cloud-down",
                message: "Error: No response from API.<br>(loadDashboardData)",
            }, {
                type: 'danger',
                timer: 3000,
            });
        });
}

function loadBlocksList() {
    return $.ajax(API + 'pools/' + currentPool + '/blocks?pageSize=100')
        .done(function (data) {
            var blockList = '<thead><tr><th>Date &amp; Time</th><th>Height</th><th>Effort</th><th>Status</th><th>Reward</th><th colspan="2">Confirmation</th></tr></thead><tbody>';
            if (data.length > 0) {
                $.each(data, function (index, value) {
                    blockList += '<tr>';
                    blockList += '<td>' + _dateFormatter(value.created) + '</td>';
                    blockList += '<td>' + value.blockHeight + '</td>';
                    if (typeof(value.effort) !== "undefined") {
                        blockList += '<td>~' + Math.round(value.effort * 100) + '%</td>';
                    } else {
                        blockList += '<td>n/a</td>';
                    }
                    blockList += '<td>' + value.status + '</td>';
                    blockList += '<td>' + _formatter(value.reward, 5, '') + '</td>';
                    blockList += '<td>~' + Math.round(value.confirmationProgress * 100) + '%</td>';
                    blockList += '<td colspan="3"><a href="' + value.infoLink + '" target="_blank">' + value.transactionConfirmationData.substring(0, 16) + ' &hellip; ' + value.transactionConfirmationData.substring(value.transactionConfirmationData.length - 16) + ' </a></td>';
                    blockList += '</tr>'
                });
            } else {
                blockList += '<tr><td colspan="8">None</td></tr>';
            }
            blockList += '</tbody>';
            $('#blockList').html(blockList);
        })
        .fail(function () {
            $.notify({
                icon: "ti-cloud-down",
                message: "Error: No response from API.<br>(loadBlocksList)",
            }, {
                type: 'danger',
                timer: 3000,
            });
        });
}

function loadPaymentsList(walletAddress) {
    return $.ajax(API + 'pools/' + currentPool + '/miners/' + walletAddress + '/payments?pageSize=100')
        .done(function (data) {
            var paymentList = '<thead><tr><th>Date &amp; Time</th><th>Amount</th><th colspan="2">Confirmation</th>>/tr></thead><tbody>';
            if (data.length > 0) {
                $.each(data, function (index, value) {
                    paymentList += '<tr>';
                    paymentList += '<td>' + _dateFormatter(value.created) + '</td>';
                    paymentList += '<td>' + _formatter(value.amount, 5, '') + '</td>';
                    paymentList += '<td colspan="2"><a href="' + value.transactionInfoLink + '" target="_blank">' + value.transactionConfirmationData + ' </a></td>';
                    paymentList += '</tr>';
                });
            } else {
                paymentList += '<tr><td colspan="5">None</td></tr>';
            }
            paymentList += '</tbody>';
            $('#paymentList').html(paymentList);
        })
        .fail(function () {
            $.notify({
                icon: "ti-cloud-down",
                message: "Error: No response from API.<br>(loadPaymentsList)",
            }, {
                type: 'danger',
                timer: 3000,
            });
        });
}

function loadConnectConfig() {
    $('div[id*=Config').hide();
    $('#' + currentPool + 'Config').show();

    return $.ajax(API + 'pools')
        .done(function (data) {
            var connectPoolConfig = '<tbody>';
            $.each(data.pools, function (index, value) {
                if (currentPool === value.id) {
                    connectPoolConfig += '<tr><td>Algorithm</td><td>' + value.coin.algorithm + '</td></tr>';
                    // connectPoolConfig += '<tr><td>Payout Scheme</td><td>' + value.paymentProcessing.payoutScheme + '</td></tr>';
                    connectPoolConfig += '<tr><td>Minimum Payment</td><td>' + value.paymentProcessing.minimumPayment + '</td></tr>';
                    if (typeof(value.paymentProcessing.minimumPaymentToPaymentId) !== "undefined") {
                        connectPoolConfig += '<tr><td>Minimum Payment w/ #</td><td>' + value.paymentProcessing.minimumPaymentToPaymentId + '</td></tr>';
                    }
                    connectPoolConfig += '<tr><td>Pool Fee</td><td>' + value.poolFeePercent + '%</td></tr>';
                    connectPoolConfig += '<tr><td>Username</td><td>Your ' + value.coin.type + ' address</td></tr>';
                    connectPoolConfig += '<tr><td>Password</td><td>Anything</td></tr>';
                    connectPoolConfig += '<tr><td>Url</td><td>stratum+tcp://evocation.network</td></tr>';
                    connectPoolConfig += '<tr><td>Ports</td><td>';
                    var first = true;
                    $.each(value.ports, function (port, options) {
                        if(!first) {
                            connectPoolConfig += '<br />'
                        }
                        else {
                            first = true;
                        }
                        connectPoolConfig += port + ' &rarr; ';
                        if (typeof(options.varDiff) !== "undefined") {
                            connectPoolConfig += 'variable diff / ' + options.varDiff.minDiff + ' &harr; ';
                            if (typeof(options.varDiff.maxDiff) === "undefined") {
                                connectPoolConfig += '&infin;';
                            } else {
                                connectPoolConfig += options.varDiff.maxDiff;
                            }
                        } else {
                            connectPoolConfig += 'static diff / ' + options.difficulty;
                        }
                    });
                    connectPoolConfig += '</td></tr>';
                }
            });
            connectPoolConfig += '</tbody>';
            $('#connectPoolConfig').html(connectPoolConfig);
        })
        .fail(function () {
            $.notify({
                icon: "ti-cloud-down",
                message: "Error: No response from API.<br>(loadConnectConfig)",
            }, {
                type: 'danger',
                timer: 3000,
            });
        });
}
