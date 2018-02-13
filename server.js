
const util = require('util');
const https = require('https');
const qs = require('querystring');
const Q = require('q');
const fs = require('fs');
const xml2json = require('xml-js').xml2json;

const API = {
    getJsLoginUrl: params => `https://login.wx.qq.com/jslogin?${params}`,
};

API.getUUID = () => {
    const deferred = Q.defer();
    const params = qs.stringify({
        appid: 'wx782c26e4c19acffb',
        redirect_uri: 'https://wx.qq.com/cgi-bin/mmwebwx-bin/webwxnewloginpage',
        _: (new Date()).getTime(),
        fun: 'new',
        lang: 'zh_CN',
    });
    const req = https.request({
        host: 'login.wx.qq.com',
        port: '443',
        path: `/jslogin?${params}`,
        method: 'GET',
        headers: {
            Accept: '*/*',
            Pragma: 'no-cache',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.140 Safari/537.36',
        }
    }, res => {
        res.on('data', d => {
            // .e.g window.QRLogin.code = 200; window.QRLogin.uuid = "AaLrP-vPmA==";
            const result = d.toString().split('"')[1];
            deferred.resolve(result);
        });
    }).on('error', e => {
        deffered.reject(e);
    });
    console.log('request:', req.method, req._headers.host, req.path, '    ');
    req.end();
    return deferred.promise;
};

API.getQRCode = uuid => {
    const deffered = Q.defer();
    const req = https.request({
        host: 'login.weixin.qq.com',
        port: '443',
        path: `/qrcode/${uuid}`,
        method: 'GET',
        headers: {
            Accept: 'image/webp,image/apng,image/*,*/*;q=0.8',
            Pragma: 'no-cache',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.140 Safari/537.36',
        }
    }, res => {
        res.setEncoding('binary');
        let chunk = '';
        res.on('data', d => {
            chunk += d;
        });
        res.on('end', () => {
            fs.writeFileSync('temp/qrcode.png', chunk, 'binary');
        });
    });
    console.log('request:', req.method, req._headers.host, req.path, '    ');
    req.end();
    return deffered.promise;
};

API.loginCheck = uuid => {
    const deffered = Q.defer();
    const params = qs.stringify({
        loginicon: true,
        uuid: uuid,
        tip: 0,
        r: ~new Date,
        _: (new Date()).getTime(),
    });
    const req = https.request({
        host: 'login.wx.qq.com',
        port: '443',
        path: `/cgi-bin/mmwebwx-bin/login?${params}`,
        method: 'GET',
        headers: {
            Accept: '*/*',
            Pragma: 'no-cache',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.140 Safari/537.36',
        }
    }, res => {
        let data = '';
        res.on('data', d => {
            data += d;
        });
        res.on('end', () => {
            const result = data.toString();
            if (result.indexOf('200') > -1) {
                const redirectUri = result.split('"')[1];
                deffered.resolve({
                    success: true,
                    result,
                    redirectUri,
                });
            } else {
                API.loginCheck(uuid).then(result => {
                    if (result.redirectUri) {
                        deffered.resolve(result);
                    }
                });
            }
        });
    }).on('error', error => {
        deffered.reject({
            success: false,
            error,
        });
    });
    console.log('request:', req.method, req._headers.host, req.path, '    ');
    req.end();
    return deffered.promise;
};

API.login = redirectUri => {
    const deffered = Q.defer();
    const req = https.get(redirectUri, res => {
        let data = '';
        res.on('data', d => {
            data += d;
        });
        res.on('end', () => {
            const result = xml2json(data.toString(), {compact: true, spaces: 4});
            deffered.resolve(result);
        });
    });
    console.log('request:', req.method, req._headers.host, req.path, '    ');
    req.end();
    return deffered.promise;
};

API.getUUID().then(uuid => {
    API.getQRCode(uuid);
    return uuid;
}).then(uuid => API.loginCheck(uuid))
.then(data => {
    const redirectUri = data.redirectUri;
    return API.login(redirectUri);
}).then(data => {
    
});
