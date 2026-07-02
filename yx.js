var globalHeaders = [];
var classes = [];
var categories = {};
var webPaths = {};
var sourceHeaders = {};
var sourceConfigs = {};
var vodSourceConfigs = {};
var globalHostHeaders = {};
var processedHosts = new Set();

// ========== 自定义分类图标配置区 ==========
const classIconMap = {
    "你咋那么美": "https://nauxij.github.io/yan.jpg",
    "02605271508": "https://nauxij.github.io/yan1.jpg",
    "0260612": "https://nauxij.github.io/yan2.jpg",
    "026061218650": "https://nauxij.github.io/Popc.jpg",
    "今生最酷合影": "https://nauxij.github.io/%E4%BB%8A%E7%94%9F%E6%9C%80%E9%85%B7%E5%90%88%E5%90%88.jpg",
    "Popc": "https://nauxij.github.io/Popc.jpg"
};

function getClassIconByName(className) {
    // 全局清除所有 ,#genre# 后缀，彻底解决匹配失败根源
    let realName = className.trim()
        .replace(/,#genre#/g, '');
    if (!realName) return "https://nauxij.github.io/Popc.jpg";
    const lowerName = realName.toLowerCase();
    const mapKeys = Object.keys(classIconMap);

    // 1. 小写完全匹配（兼容大小写不一致）
    for (const key of mapKeys) {
        if (key.toLowerCase() === lowerName) {
            return classIconMap[key];
        }
    }

    // 2. 原始文字精准匹配
    if (classIconMap[realName]) {
        return classIconMap[realName];
    }

    // 3. 双向模糊包含匹配
    for (const key of mapKeys) {
        const lowerKey = key.toLowerCase();
        if (lowerKey.includes(lowerName) || lowerName.includes(lowerKey)) {
            return classIconMap[key];
        }
    }

    // 无匹配返回兜底图
    return "https://nauxij.github.io/Popc.jpg";
}

function init(inputData) {
    initGlobalHeaders();
    try {
        var parsedData = JSON.parse(inputData.trim());
        var configs = extractLivesConfig(parsedData);
        if (configs && configs.length > 0) {
            for (var i = 0; i < configs.length; i++) {
                var config = normalizeConfig(configs[i]);
                if (config.host) continue;
                var typeId = config.name + '$' + config.url;
                var typeName = config.name;
                // 新增icon字段，绑定分类图标
                classes.push({
                    'type_id': typeId,
                    'type_name': typeName,
                    'icon': getClassIconByName(typeName)
                });
                // 存储源配置
                if (config.headers && Object.keys(config.headers)
                    .length > 0) {
                    sourceHeaders[typeId] = config.headers;
                    sourceConfigs[typeId] = {
                        headers: config.headers,
                        play_parse: config.play_parse || false
                    };
                    // 提取host并添加全局headers
                    if (config.url) {
                        var hostFromUrl = extractHostFromUrl(config.url);
                        if (hostFromUrl && !processedHosts.has(hostFromUrl)) {
                            addToGlobalHeaders(hostFromUrl, config.headers);
                            processedHosts.add(hostFromUrl);
                        }
                    }
                } else {
                    sourceConfigs[typeId] = {
                        headers: {},
                        play_parse: config.play_parse || false
                    };
                }
            }
            return;
        }
    } catch (error) {
        console.error('JSON解析错误:', error);
    }
    // 处理非JSON格式的输入数据
    var baseUrl = '';
    if (inputData.indexOf('$$$') > 0) {
        baseUrl = inputData.split('$$$')[0].trim();
        inputData = inputData.split('$$$')[1].trim();
    }
    if (inputData.indexOf('&&&') > 0) {
        inputData = inputData.split('&&&')[0].trim();
    }
    var parts = inputData.split('#');
    for (var j = 0; j < parts.length; j++) {
        var part = parts[j];
        if (part.indexOf('$') > 0) {
            var typeId = part;
            var typeName = part.split('$')[0];
            var cleanTypeName = typeName.replace('!!', '');
            if (typeId.indexOf('://') < 0) {
                typeId = typeId.replace('$', '$' + baseUrl);
            }
            classes.push({
                'type_id': typeId,
                'type_name': cleanTypeName,
                'icon': getClassIconByName(cleanTypeName)
            });
        } else {
            var url = part;
            if (url.indexOf('://') < 0) {
                url = baseUrl + url;
            }
            var requestHeaders = getHeadersForUrl(url);
            try {
                var response = req(url, {
                    'method': 'GET',
                    'headers': requestHeaders
                });
                var data = JSON.parse(response.content);
                var pathPrefix = url.substring(0, url.lastIndexOf('/') + 1);
                for (var k = 0; k < data.length; k++) {
                    var item = data[k];
                    var itemName = item.name;
                    var itemUrl = item.url;
                    var itemTypeId = itemName + '$' + (itemUrl.indexOf('://') < 0 ? pathPrefix : '') + itemUrl;
                    var cleanItemName = itemName.replace('!!', '');
                    classes.push({
                        'type_id': itemTypeId,
                        'type_name': cleanItemName,
                        'icon': getClassIconByName(cleanItemName)
                    });
                    var normalizedItem = normalizeConfig(item);
                    if (normalizedItem.headers && Object.keys(normalizedItem.headers)
                        .length > 0) {
                        sourceHeaders[itemTypeId] = normalizedItem.headers;
                        sourceConfigs[itemTypeId] = normalizedItem;
                    }
                }
            } catch (error) {
                console.error('加载二级数据错误:', error);
            }
        }
    }
}

function extractLivesConfig(parsedData) {
    if (Array.isArray(parsedData)) {
        return parsedData;
    }
    if (typeof parsedData === 'object' && parsedData !== null) {
        var livesKey = Object.keys(parsedData)
            .find(key => key.toLowerCase() === 'lives');
        if (livesKey && Array.isArray(parsedData[livesKey])) {
            return parsedData[livesKey];
        }
    }
    return null;
}

function normalizeConfig(config) {
    var normalized = Object.assign({}, config);
    if (config.ua && typeof config.ua === 'string') {
        if (!normalized.headers) {
            normalized.headers = {};
        }
        normalized.headers['User-Agent'] = config.ua;
        delete normalized.ua;
    }
    if (config.header && typeof config.header === 'object') {
        if (!normalized.headers) {
            normalized.headers = {};
        }
        Object.assign(normalized.headers, config.header);
        delete normalized.header;
    }
    return normalized;
}

function extractHostFromUrl(url) {
    try {
        var urlObj = new URL(url);
        return urlObj.host;
    } catch (error) {
        var match = url.match(/:\/\/([^\/]+)/);
        return match ? match[1] : null;
    }
}

function addToGlobalHeaders(host, headers) {
    if (!host || !headers || Object.keys(headers)
        .length === 0) return;
    var exists = false;
    for (var i = 0; i < globalHeaders.length; i++) {
        if (globalHeaders[i].host === host) {
            exists = true;
            break;
        }
    }
    if (!exists) {
        globalHeaders.push({
            "host": host,
            "header": headers
        });
        globalHostHeaders[host] = headers;
    }
}

function initGlobalHeaders() {
    for (var i = 0; i < globalHeaders.length; i++) {
        var config = globalHeaders[i];
        if (config.host && config.header) {
            globalHostHeaders[config.host] = config.header;
        }
    }
}

function getHeadersForUrl(url) {
    var resultHeaders = {};
    try {
        var urlObj = new URL(url);
        var host = urlObj.host;
        if (globalHostHeaders[host]) {
            resultHeaders = Object.assign({}, globalHostHeaders[host]);
        } else {
            for (var pattern in globalHostHeaders) {
                if (pattern.includes('*') && url.includes(pattern.replace(':*', ''))) {
                    resultHeaders = Object.assign({}, globalHostHeaders[pattern]);
                    break;
                } else if (url.includes(pattern)) {
                    resultHeaders = Object.assign({}, globalHostHeaders[pattern]);
                    break;
                }
            }
        }
    } catch (error) {
        for (var pattern in globalHostHeaders) {
            if (url.includes(pattern.replace(':*', ''))) {
                resultHeaders = Object.assign({}, globalHostHeaders[pattern]);
                break;
            }
        }
    }
    return resultHeaders;
}

function getPlayHeaders(playUrl, sourceConfig) {
    var playHeaders = getHeadersForUrl(playUrl);
    var hasGlobalHeaders = Object.keys(playHeaders)
        .length > 0;
    if (!hasGlobalHeaders && sourceConfig && sourceConfig.headers && Object.keys(sourceConfig.headers)
        .length > 0) {
        playHeaders = Object.assign({}, playHeaders, sourceConfig.headers);
    }
    return playHeaders;
}

function home(param) {
    return JSON.stringify({
        'class': classes,
        'filters': null
    });
}

function homeVod(param) {
    if (classes.length === 0) return JSON.stringify({
        'list': []
    });
    var data = getCategoryData(classes[0].type_id);
    return JSON.stringify({
        'list': data
    });
}

function category(categoryId, page, filter, extend) {
    var data = [];
    if (page == 1) {
        data = getCategoryData(categoryId);
    }
    return JSON.stringify({
        'list': data
    });
}

function getCategoryData(categoryId) {
    var namePart = categoryId.split('$')[0];
    var cleanName = namePart.replace('!!', '');
    var imageUrl = getClassIconByName(cleanName);

    var urlPart = categoryId.split('$')[1];

    if (!categories[categoryId]) {
        categories[categoryId] = [];

        var requestHeaders = getHeadersForUrl(urlPart);
        if (sourceHeaders[categoryId] && Object.keys(sourceHeaders[categoryId])
            .length > 0) {
            requestHeaders = Object.assign({}, requestHeaders, sourceHeaders[categoryId]);
        }

        if (urlPart.indexOf('|') > 0) {
            var paramsStr = decodeURIComponent(urlPart.split('|')[1]);
            urlPart = urlPart.split('|')[0];
            var params = paramsStr.split('&');
            for (var l = 0; l < params.length; l++) {
                var param = params[l];
                if (param.indexOf('=') > 0) {
                    var key = param.split('=')[0];
                    var value = param.split('=')[1];
                    requestHeaders[key] = value;
                }
            }
        }

        try {
            var response = req(urlPart, {
                'method': 'GET',
                'headers': requestHeaders
            });
            var responseContent = response.content.trim();
            var parsedContent = '';

            if (responseContent.indexOf('#EXTM3U') >= 0) {
                parsedContent = parseM3u(responseContent, cleanName);
            } else if (responseContent.indexOf('"channel"') > 0 && responseContent.indexOf('"urls"') > 0) {
                parsedContent = parseFm(responseContent);
            } else if (responseContent.indexOf('"datalist"') > 0 && responseContent.indexOf('"urls"') > 0) {
                parsedContent = parseList(responseContent);
            } else {
                parsedContent = responseContent;
            }

            parseContent(parsedContent, categoryId, cleanName, imageUrl);

        } catch (error) {
            console.error('获取分类数据失败:', error, '分类ID:', categoryId);
        }
    }

    return categories[categoryId];
}

function parseContent(content, categoryId, typeName, imageUrl) {
    var lines = (typeName + '\n' + content.replace('\r', ''))
        .split('\n');
    var currentCategory = typeName;
    var currentUrls = '';

    for (var m = 0; m < lines.length; m++) {
        var line = lines[m].replace(/\s+/g, '');

        if (line != '' && line.indexOf('://') < 0 && (line.indexOf(',') < 0 || line.indexOf('#genre#') > 0)) {
            if (currentUrls != '') {
                saveCategoryItem(categoryId, currentCategory, currentUrls, typeName, imageUrl);
            }
            currentCategory = line.split(',')[0].trim();
            currentUrls = '';
        } else if (line.indexOf(',') > 0 && /http|rtmp|rtsp|rsp/.test(line)) {
            var parts = line.split(',');
            var channelName = parts[0].trim();
            var channelUrl = parts[1].trim();

            if (channelUrl && sourceHeaders[categoryId] && Object.keys(sourceHeaders[categoryId])
                .length > 0) {
                var secondaryHost = extractHostFromUrl(channelUrl);
                if (secondaryHost && !processedHosts.has(secondaryHost)) {
                    addToGlobalHeaders(secondaryHost, sourceHeaders[categoryId]);
                    processedHosts.add(secondaryHost);
                }
            }

            if (currentUrls != '') {
                currentUrls += '#';
            }
            currentUrls += channelName + '$' + channelUrl;
        }
    }

    if (currentUrls != '') {
        saveCategoryItem(categoryId, currentCategory, currentUrls, typeName, imageUrl);
    }

    return lines;
}

function saveCategoryItem(categoryId, categoryName, urls, typeName, imageUrl) {
    var processedImageUrl = imageUrl;

    var vodId = categoryId + '$$$' + categories[categoryId].length;
    vodSourceConfigs[vodId] = {
        sourceHeaders: sourceHeaders[categoryId] || {},
        sourceConfig: sourceConfigs[categoryId] || {},
        categoryId: categoryId
    };

    var item = {
        'vod_id': vodId,
        'vod_name': categoryName,
        'vod_pic': processedImageUrl,
        'vod_remarks': '',
        'type_name': '',
        'vod_year': '',
        'vod_area': '',
        'vod_actor': '',
        'vod_director': '',
        'vod_content': '',
        'vod_play_from': typeName,
        'vod_play_url': urls
    };
    categories[categoryId].push(item);
}

function parseM3u(content, categoryName) {
    var result = {};
    var regex = /(#EXTINF:.+?),([^,]+?)\s*\n(.+?)\s*\n/g;
    var match;
    while ((match = regex.exec(content)) !== null) {
        var infTag = match[1];
        var name = match[2];
        var url = match[3];
        if (!name || !url || name == '' || url == '') continue;
        name = name.trim();
        url = url.trim();
        var group = categoryName;
        var groupRegex = /group-title="(.*?)"/;
        if (groupRegex.test(infTag)) {
            group = infTag.match(groupRegex)[1];
        }
        if (!result[group]) result[group] = [];
        result[group].push(name + ',' + url);
    }
    var output = '';
    for (var group in result) {
        if (result.hasOwnProperty(group)) {
            output += group + '\n';
            result[group].forEach(item => output += item + '\n');
        }
    }
    return output;
}

function parseFm(content) {
    var output = '';
    try {
        var data = JSON.parse(content);
        data.forEach(item => {
            var channelName = item.name;
            var urls = item.urls;
            output += channelName + ',#genre#\n';
            urls.forEach(urlItem => {
                var itemName = urlItem.name;
                urlItem.datalist.forEach(url => {
                    output += itemName + ',' + url + '\n';
                });
            });
        });
    } catch (error) {
        console.error('解析Fm数据错误:', error);
    }
    return output;
}

function parseList(content) {
    var output = '';
    try {
        var data = JSON.parse(content)
            .data;
        data.list.forEach(item => {
            var channelName = item.prov;
            var programs = item.list;
            output += channelName + ',#genre#\n';
            programs.forEach(program => {
                var programName = program.name;
                program.datalist.forEach(urlItem => {
                    output += programName + ' ===>>> ' + urlItem.vod_play_from + ',' + urlItem.vod_play_url + '\n';
                });
            });
        });
    } catch (error) {
        console.error('解析List数据错误:', error);
    }
    return output;
}

function detail(detailId) {
    var parts = detailId.split('$$$');
    var categoryId = parts[0];
    var index = parseInt(parts[1]);

    if (!categories[categoryId] || !categories[categoryId][index]) {
        return JSON.stringify({
            'list': []
        });
    }

    var detailData = categories[categoryId][index];
    var itemId = categoryId.split('$')[0];

    if (itemId.indexOf('!!') >= 0) {
        itemId = itemId.replace('!!', '');
        var urls = detailData.vod_play_url.split('#');
        var countMap = {};
        var groupMap = {};

        urls.forEach(url => {
            var namePart = url.split('$')[0];
            var displayName = itemId;

            if (namePart.indexOf(' ===>>> ') > 0) {
                displayName = namePart.split(' ===>>> ')[1];
                namePart = namePart.split(' ===>>> ')[0];
            }

            countMap[namePart] = (countMap[namePart] || 0) + 1;
            displayName = itemId + (countMap[namePart] > 1 ? ' ' + countMap[namePart] : '');

            if (!groupMap[displayName]) groupMap[displayName] = [];
            groupMap[displayName].push(namePart + '$' + url.split('$')[1]);
        });

        var groupNames = Object.keys(groupMap);
        var groupUrls = groupNames.map(name => groupMap[name].join('#'));

        detailData.vod_play_from = groupNames.join('$$$');
        detailData.vod_play_url = groupUrls.join('$$$');
    }

    return JSON.stringify({
        'list': [detailData]
    });
}

function play(playId, playUrl, param) {
    var parse = 0;
    var sourceConfig = null;

    if (vodSourceConfigs[playId]) {
        var vodConfig = vodSourceConfigs[playId];
        sourceConfig = vodConfig.sourceConfig;
        if (vodConfig.sourceConfig && vodConfig.sourceConfig.play_parse !== undefined) {
            parse = vodConfig.sourceConfig.play_parse ? 1 : 0;
        }
    }

    var playHeaders = getPlayHeaders(playUrl, sourceConfig);

    return JSON.stringify({
        'parse': parse,
        'url': playUrl,
        'header': playHeaders,
        'js': '',
        'extra': {}
    });
}

function search(keyword, param) {
    return JSON.stringify({
        'list': []
    });
}

// 导出核心函数
__JS_SPIDER__ = {
    'init': init,
    'home': home,
    'homeVod': homeVod,
    'category': category,
    'detail': detail,
    'play': play,
    'search': search
};