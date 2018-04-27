const util = require('util');
const https = require('https');
const http = require('http');
const qs = require('querystring');
const Q = require('q');
const fs = require('fs');
const xml2json = require('xml-js').xml2json;
const zlib = require('zlib');
const request = require('request');

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
        var setcookie = res.headers["set-cookie"];
        if (setcookie) {
            setcookie.forEach(
                function(cookiestr) {
                    console.log("COOKIE:" + cookiestr);
                }
            );
        }
        res.on('data', d => {
            // .e.g window.QRLogin.code = 200; window.QRLogin.uuid = "AaLrP-vPmA==";
            const result = d.toString().split('"')[1];
            deferred.resolve(result);
        });
    }).on('error', e => {
        deferred.reject(e);
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
        var setcookie = res.headers["set-cookie"];
        if (setcookie) {
            setcookie.forEach(
                function(cookiestr) {
                    console.log("COOKIE:" + cookiestr);
                }
            );
        }
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
        var setcookie = res.headers["set-cookie"];
        if (setcookie) {
            setcookie.forEach(
                function(cookiestr) {
                    console.log("COOKIE:" + cookiestr);
                }
            );
        }
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
        var setcookie = res.headers["set-cookie"];
        if (setcookie) {
            setcookie.forEach(
                function(cookiestr) {
                    // console.log("COOKIE:" + cookiestr);
                }
            );
        }
        let data = '';
        res.on('data', d => {
            data += d;
        });
        res.on('end', () => {
            const result = xml2json(data.toString(), {
                compact: true,
                spaces: 4
            });
            deffered.resolve({
                data: JSON.parse(result),
                cookies: setcookie,
            });
        });
    });
    console.log('request:', req.method, req._headers.host, req.path, '    ');
    req.end();
    return deffered.promise;
};

API.wxInit = (loginInfo, cookies) => {
    const deffered = Q.defer();
    // const params = qs.stringify({
    //     pass_ticket: loginInfo.error.pass_ticket._text,
    //     r: ~new Date,
    // });
    const params = qs.stringify({
        // pass_ticket: loginInfo.error.pass_ticket._text,
        r: 1496503747,
        lang: 'en',
    });
    // const payload = qs.stringify({
    //     BaseRequest: {
    //         DeviceID: API.getDeviceID(),
    //         Sid: loginInfo.error.wxsid._text,
    //         Skey: loginInfo.error.skey._text,
    //         Uin: loginInfo.error.wxuin._text,
    //     }
    // });
    var payload = JSON.stringify({
        "BaseRequest": {
            "Uin": "893061000",
            "Sid": "CFfT6RJhqdKGwuPp",
            "Skey": "",
            "DeviceID": "e320178262174323"
        }
    });
    var payload = {
        "BaseRequest": {
            "Uin": "893061000",
            "Sid": "CFfT6RJhqdKGwuPp",
            "Skey": "",
            "DeviceID": "e320178262174323"
        }
    };
    const req = request.post({
        url: `https://wx.qq.com/cgi-bin/mmwebwx-bin/webwxinit?r=1370891618&lang=en`,
        method: 'POST',
        gzip: true,
        body: payload,
        json: true,
        headers: {
            Accept: 'application/json, text/plain, */*',
            Pragma: 'no-cache',
            origin: 'https://wx.qq.com',
            Referer: 'https://wx.qq.com/?&lang=en',
            DNT: 1,
            'content-type': 'application/json;charset=UTF-8',
            // 'Content-Length': Buffer.byteLength(payload),
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.140 Safari/537.36',
            // 'Cookie': cookies.map(cookie => cookie.split(';')[0]).join(';'),
            'Cookie': 'wxuin=893061000; MM_WX_NOTIFY_STATE=1; MM_WX_SOUND_STATE=1; wxuin=893061000; webwxuvid=c2ed8b9cd0ec68810998f97c48674d48afa6646adbc421e6235cd63b6aac2856aef6b403738035c2acd46ecdf7d8cde4; last_wxuin=893061000; mm_lang=en; wxpluginkey=1519030082; wxsid=CFfT6RJhqdKGwuPp; webwx_data_ticket=gSetAmskisgpkwSf9cPKD9Sf; webwx_auth_ticket=CIsBEPaK7WwagAGsio4AX95SiyQNKgKB1yPYkfsQnNMFASuB4DEvGnzA70ehf6ynrx1bM27yWeu3wu2TRJgjRBcIU6KFn1J+7lvMXldCsPcRC0hY6cF82dZdxaM1Py2DqGCOtP0UlKvzlG4OBVVIfrZbzxf4FMEJsKJ9HiXXmEjvtiMvpsCl/Quk9A==; login_frequency=3; wxloadtime=1519047524_expired',
        }
    }, (error, response, body) => {
        deffered.resolve(body);
    });
    return deffered.promise;
}
API.getDeviceID = () => {
    const id = Math.random().toFixed(15).toString().substring(2, 17);
    return `e${id}`;
};

API.getContacts = (data, cookies) => {
    const deffered = Q.defer();
    // const {
    //     pass_ticket,
    //     skey,
    //     wxuin,
    //     wxsid
    // } = data;
    // const deffered = Q.defer();
    // const params = qs.stringify({
    //     pass_ticket: pass_ticket._text,
    //     r: Date.now(),
    //     seq: 0,
    //     skey: skey._text,
    // });
    request.get({
        // host: 'wx.qq.com',
        // port: 443,
        // path: `/cgi-bin/mmwebwx-bin/webwxgetcontact?${params}`,
        url: `https://wx.qq.com/cgi-bin/mmwebwx-bin/webwxgetcontact?lang=en&r=1519047531810&seq=0&skey=@crypt_cf91b77d_71e05e21526bd46dbba3e1d406ed1765`,
        gzip: true,
        headers: {
            Accept: 'application/json, text/plain, */*',
            Pragma: 'no-cache',
            'content-type': 'application/json;charset=UTF-8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.140 Safari/537.36',
            // 'Cookie': cookies.map(cookie => cookie.split(';')[0]).join(';'),
            'Cookie': 'wxuin=893061000; MM_WX_NOTIFY_STATE=1; MM_WX_SOUND_STATE=1; wxuin=893061000; webwxuvid=c2ed8b9cd0ec68810998f97c48674d48afa6646adbc421e6235cd63b6aac2856aef6b403738035c2acd46ecdf7d8cde4; last_wxuin=893061000; mm_lang=en; wxpluginkey=1519030082; wxsid=CFfT6RJhqdKGwuPp; webwx_data_ticket=gSetAmskisgpkwSf9cPKD9Sf; webwx_auth_ticket=CIsBEPaK7WwagAGsio4AX95SiyQNKgKB1yPYkfsQnNMFASuB4DEvGnzA70ehf6ynrx1bM27yWeu3wu2TRJgjRBcIU6KFn1J+7lvMXldCsPcRC0hY6cF82dZdxaM1Py2DqGCOtP0UlKvzlG4OBVVIfrZbzxf4FMEJsKJ9HiXXmEjvtiMvpsCl/Quk9A==; login_frequency=3; wxloadtime=1519047524_expired',
        }
    }, (err, res, body) => {
        deffered.resolve(body);
    });
    // console.log('request:', req.method, req._headers.host, req.path, req._headers.cookie, '    ');
    return deffered.promise;
};

API.createChatRooom = () => {
    const deffered = Q.defer();
    const payload = {
        "MemberCount": 3,
        "MemberList": [{
            "UserName": "@a275ac879002e5a4c66d06e9846bc62f6e7e19cab1815601b5b9ec58adfa0e82"
        }, {
            "UserName": "@1aad8785fb61859d83fe0839e5586cbb"
        }, {
            "UserName": "@6417011f3d54088098b943740841f0cc3f35a82100c63f387f715725b78f5812"
        }],
        "Topic": "",
        "BaseRequest": {
            "Uin": 893061000,
            "Sid": "CFfT6RJhqdKGwuPp",
            "Skey": "@crypt_cf91b77d_71e05e21526bd46dbba3e1d406ed1765",
            "DeviceID": "e666665504267900"
        }
    };
    request.post({
        url: `https://wx.qq.com/cgi-bin/mmwebwx-bin/webwxcreatechatroom?r=1519051256010&lang=en`,
        gzip: true,
        body: payload,
        json: true,
        headers: {
            Accept: 'application/json, text/plain, */*',
            Pragma: 'no-cache',
            'content-type': 'application/json;charset=UTF-8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.140 Safari/537.36',
            // 'Cookie': cookies.map(cookie => cookie.split(';')[0]).join(';'),
            'Cookie': 'wxuin=893061000; MM_WX_NOTIFY_STATE=1; MM_WX_SOUND_STATE=1; wxuin=893061000; webwxuvid=c2ed8b9cd0ec68810998f97c48674d48afa6646adbc421e6235cd63b6aac2856aef6b403738035c2acd46ecdf7d8cde4; last_wxuin=893061000; mm_lang=en; wxpluginkey=1519030082; wxsid=CFfT6RJhqdKGwuPp; webwx_data_ticket=gSetAmskisgpkwSf9cPKD9Sf; webwx_auth_ticket=CIsBEPaK7WwagAGsio4AX95SiyQNKgKB1yPYkfsQnNMFASuB4DEvGnzA70ehf6ynrx1bM27yWeu3wu2TRJgjRBcIU6KFn1J+7lvMXldCsPcRC0hY6cF82dZdxaM1Py2DqGCOtP0UlKvzlG4OBVVIfrZbzxf4FMEJsKJ9HiXXmEjvtiMvpsCl/Quk9A==; login_frequency=3; wxloadtime=1519047524_expired',
        }
    }, (err, res, body) => {
        deffered.resolve(body);
    });
    return deffered.promise;
}

API.deleteChatRoom = () => {
    const deffered = Q.defer();
    const payload = {
        "ChatRoomName": "@@41ba125a61514de816229b3a735ed9d1cf6b310ac4e9b8ce6c1dcc1a3fce7f91",
        "BaseRequest": {
            "Uin": 893061000,
            "Sid": "CFfT6RJhqdKGwuPp",
            "Skey": "@crypt_cf91b77d_71e05e21526bd46dbba3e1d406ed1765",
            "DeviceID": "e989999988560895"
        }
    };
    request.post({
        url: 'https://wx.qq.com/cgi-bin/mmwebwx-bin/webwxupdatechatroom?fun=delmember&lang=en',
        json: true,
        gzip: true,
        body: payload,
        headers: {
            Accept: 'application/json, text/plain, */*',
            Pragma: 'no-cache',
            'content-type': 'application/json;charset=UTF-8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.140 Safari/537.36',
            // 'Cookie': cookies.map(cookie => cookie.split(';')[0]).join(';'),
            'Cookie': 'wxuin=893061000; MM_WX_NOTIFY_STATE=1; MM_WX_SOUND_STATE=1; wxuin=893061000; webwxuvid=c2ed8b9cd0ec68810998f97c48674d48afa6646adbc421e6235cd63b6aac2856aef6b403738035c2acd46ecdf7d8cde4; last_wxuin=893061000; mm_lang=en; wxpluginkey=1519030082; wxsid=CFfT6RJhqdKGwuPp; webwx_data_ticket=gSetAmskisgpkwSf9cPKD9Sf; webwx_auth_ticket=CIsBEPaK7WwagAGsio4AX95SiyQNKgKB1yPYkfsQnNMFASuB4DEvGnzA70ehf6ynrx1bM27yWeu3wu2TRJgjRBcIU6KFn1J+7lvMXldCsPcRC0hY6cF82dZdxaM1Py2DqGCOtP0UlKvzlG4OBVVIfrZbzxf4FMEJsKJ9HiXXmEjvtiMvpsCl/Quk9A==; login_frequency=3; wxloadtime=1519047524_expired',
        }
    }, (err, res, body) => {
        deffered.resolve(body);
    })
    return deffered.promise;
}

API.sendMsg = () => {
    const deffered = Q.defer();
    const id = (Date.now() + Math.random().toFixed(3)).replace('.', '');
    const payload = {
        "BaseRequest": {
            "Uin": 893061000,
            "Sid": "CFfT6RJhqdKGwuPp",
            "Skey": "@crypt_cf91b77d_71e05e21526bd46dbba3e1d406ed1765",
            "DeviceID": "e922976491406846"
        },
        "Msg": {
            "Type": 1,
            // "Content": Math.random() * 10 + '-test',
            content: '&lt;?xml version="1.0"?&gt;<br/>&lt;msg bigheadimgurl="http://wx.qlogo.cn/mmhead/ver_1/ic3R0yibEBLIYiajZ3ic4RmsdSicZ7ggxAaBaTpLZze1w01yVmiaKkYd77Am4S2fmQ2a4wjZz6bjt3iaTpZ2qXCM1pMlwEBqwtWlBZXndfEaibkyEtE/0" smallheadimgurl="http://wx.qlogo.cn/mmhead/ver_1/ic3R0yibEBLIYiajZ3ic4RmsdSicZ7ggxAaBaTpLZze1w01yVmiaKkYd77Am4S2fmQ2a4wjZz6bjt3iaTpZ2qXCM1pMlwEBqwtWlBZXndfEaibkyEtE/132" username="wxid_1ei36n6406mm21" nickname="æ˜Œè’²"  shortpy="" alias="changpu707" imagestatus="3" scene="17" province="Hainan" city="China" sign="" sex="2" certflag="0" certinfo="" brandIconUrl="" brandHomeUrl="" brandSubscriptConfigUrl="" brandFlags="0" regionCode="CN_Hainan_Haikou" /&gt;<br/>',
            "FromUserName": "@4baf0796414cb98c0e2662cbe2e92eb6",
            "ToUserName": "filehelper",
            "LocalID": id,
            "ClientMsgId": id,
            CreateTime: Date.now(),
            MsgType: 42,
        },
        "Scene": 0
    }
    request.post({
        url: 'https://wx.qq.com/cgi-bin/mmwebwx-bin/webwxsendmsg?lang=en',
        json: true,
        gzip: true,
        body: payload,
        headers: {
            Accept: 'application/json, text/plain, */*',
            Pragma: 'no-cache',
            'content-type': 'application/json;charset=UTF-8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.140 Safari/537.36',
            // 'Cookie': cookies.map(cookie => cookie.split(';')[0]).join(';'),
            'Cookie': 'wxuin=893061000; MM_WX_NOTIFY_STATE=1; MM_WX_SOUND_STATE=1; wxuin=893061000; webwxuvid=c2ed8b9cd0ec68810998f97c48674d48afa6646adbc421e6235cd63b6aac2856aef6b403738035c2acd46ecdf7d8cde4; last_wxuin=893061000; mm_lang=en; wxpluginkey=1519030082; wxsid=CFfT6RJhqdKGwuPp; webwx_data_ticket=gSetAmskisgpkwSf9cPKD9Sf; webwx_auth_ticket=CIsBEPaK7WwagAGsio4AX95SiyQNKgKB1yPYkfsQnNMFASuB4DEvGnzA70ehf6ynrx1bM27yWeu3wu2TRJgjRBcIU6KFn1J+7lvMXldCsPcRC0hY6cF82dZdxaM1Py2DqGCOtP0UlKvzlG4OBVVIfrZbzxf4FMEJsKJ9HiXXmEjvtiMvpsCl/Quk9A==; login_frequency=3; wxloadtime=1519047524_expired',
        }
    }, (err, res, body) => {
        deffered.resolve(body);
    });
    return deffered.promise;
}

// API.getUUID().then(uuid => {
//         API.getQRCode(uuid);
//         return uuid;
//     }).then(uuid => API.loginCheck(uuid))
//     .then(data => {
//         const redirectUri = data.redirectUri;
//         return API.login(redirectUri);
//     }).then(({
//         data,
//         cookies
//     }) => {
//         return API.wxInit(data, cookies);
//         // return API.getContacts(data.error, cookies);
//     }).then(data => {
//         console.log(data);
//         // API.getContacts();
//     });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
// API.getContacts().then(data => console.log(data))
// API.createChatRooom().then(data => console.log(data))
API.sendMsg().then(data => console.log(data));
