"use strict";

const Nodeway = require('nodeway');
const sql = require('mssql');
const crypto = require('crypto');
const config = require('./Bill.json');
const util = require('./util.js');

process.on('exit', function(code) {
    sql.close();
    console.log('Exit code:', code);
});

function query() {
    return new sql.Connection(config).connect().then(conn => conn.query.apply(conn, arguments));
}

function fillAcl(userInfo, cb) {
    query`select tld from A_tblopentld where acode=${userInfo.user} and CreateDomain=0`
    .then(tld=>{
        userInfo.acl.CreateDomain = tld.map(t=>t.tld);
        return query`select tld from A_tblopentld where acode=${userInfo.user} and DeleteDomain=0`
    })
    .then(tld=>{
        userInfo.acl.DeleteDomain = tld.map(t=>t.tld);
        return query`select tld from A_tblopentld where acode=${userInfo.user} and RenewDomain=0`
    })
    .then(tld=>{
        userInfo.acl.RenewDomain = tld.map(t=>t.tld);
        return query`select tld from A_tblopentld where acode=${userInfo.user} and TransferDomain=0`
    })
    .then(tld=>{
        userInfo.acl.TransferDomain = tld.map(t=>t.tld);
        return query`select tld from A_tblopentld where acode=${userInfo.user} and RestoreDomain=0`
    })
    .then(tld=>{
        userInfo.acl.RestoreDomain = tld.map(t=>t.tld);
        cb(null, userInfo);
    })
    .catch(cb);
}

function getdomainlen(domain){
    let len = 0;
    let s = domain.substring(0, domain.IndexOf("."));
    for (let i = 0; i < s.Length; i++){
        if (s.charAt(i) <= 0xff) len += 1;
        else len += 2;
    }
    return len;
}

function encrypt(pass){
    let hash = crypto.createHash('md5').update(pass,'utf16le').digest('hex');
    let pwd = hash.split('').map((v,i)=>i%2 != 0? v+'-':v);
    return pwd.join('').toUpperCase().slice(0,-1);
}
function handle_transaction(params, cb){
    let trans,request,opLower = params.op;
    let connection = new sql.Connection(config);
    connection.connect().then(conn=>{ 
        trans = new sql.Transaction(conn);
        request = new sql.Request(trans)
        return trans.begin();
    })
    .then(()=>request.query`insert into EPP_api values('done','user=${params.user};op=${params.op};domain=${params.domain};appID=${params.appID};registrant=${params.registrant};opDate=${params.opDate};price=${params.price};period=${params.period};exDate=${params.exDate};oldID=${params.oldID};uniID=${params.uniID}')`)
    .then(()=>request.query`insert into R_eppryde(splitdate,uniID,oldID,acode,eppop,optypeold,optype,domain,tld,appID,years,roid,opDate,price,gprice,toDate,fee,gfee,gcode,gname,aname,fromdate,opdatebj,fromdatebj,todatebj) select dateadd(hh, 8, ${params.opDate}),${params.uniID},${params.oldID},${params.acode},${params.eppop},${params.optypeold},${params.optype},${params.domain},${params.tld},${params.appID},${params.years},${params.roid},${params.opDate},${params.price},${params.gprice},${params.toDate},${params.fee},${params.gfee},gcode,gname,aname,dateadd(yyyy,abs(${params.diffyears})*(-1),${params.todate}),dateadd(hh, 8, ${params.opdate}),dateadd(hh,8,dateadd(yyyy,abs(${params.diffyears})*(-1),${params.todate})),dateadd(hh,8,${params.todate}) from View_A_tblagent where acode=${params.acode}`)
    .then(()=>{
        if(opLower != "delete"){
            return request.query`update R_eppryde set notaxfee=a.gfee/(1+b.tax) from R_eppryde a left join R_tbltax b on ( b.startdate is null or a.opdatebj>= b.startdate) and (b.enddate is null or a.opdatebj<b.enddate) where a.uniID=${params.uniID}`
                          .then(()=>request.query`update R_eppryde set addtax=gfee-notaxfee where uniID=${params.uniID}`);
        }else{
            return request.query`update a set a.notaxfee=(-1)*b.notaxfee,a.addtax=(-1)*b.addtax from R_eppryde a left join R_eppryde b on a.oldID=b.uniID where a.uniID=${params.uniID}`;
        }
    })
    .then(()=>{
        if(opLower == "transferin" || opLower == "restore"){
            if(period > 0){
                return request.query`update R_eppryde set splitdate=null where uniID=${params.uniID}`;
            }else{
                return request.query`update R_eppryde set splitdate=b.opdatebj,fromdate=b.fromdate,todate=b.todate,fromdatebj=b.fromdatebj,todatebj=b.todatebj from R_eppryde a left join  (select oldid,opdatebj,fromdate,fromdatebj,todate,todatebj from R_eppryde where uniid=${params.uniid}) b on a.uniid=b.oldid where a.uniID=${params.oldID} and b.oldID=${params.oldID}`;
            }
        }
    })
    .then((){
        if(params.tld != "hdaotest"){
            return request.query`update  A_tblagent set balance=balance+${params.fee}  where acode=${params.acode}`
                          .then(()=>request.query`update  G_tblgroup set balance=balance+${params.gfee}  where gcode=${params.gcode}`);
        }
    })
    .then(()=>{
        trans.commit(err=>{
            if(err) throw err;
            cb(null, true);
        });
    })
    .catch((err)=>{
        cb(err);
        trans.rollback();
    });
}

function editParams(params){
    let opLower = opLower.op;
    switch (opLower){
        case "transferout"://transferout不用询组价，不扣费
            params.optypeold = "transfer";
            break;
        case "delete"://转换op 并得到原组退费价格
            query`select eppop,gprice,gfee,fee from R_Eppryde where uniID=${params.oldID}`
            .then(ret=>{
                if(!ret.length){
                    throw new Error("无原始记录");
                }
                params.gprice = ret[0].gprice;
                params.gfee = (-1) * ret[0].gfee;
                params.fee = (-1) * ret[0].fee;
                switch (ret[0].eppop){
                    case "create":
                        params.optypeold = "create";
                        params.optype = "agp-deletedrawback";//oldID中的op为create，表示创建在AGP期删除
                        break;
                    case "autorenew":
                        params.optypeold = "autorenew";
                        params.optype = "au-deletedrawback";//oldID中的op为autorenew，表示自动续费后在自动续费期删除了域名退费
                        break;
                }
            });                                        
            break;
        default:
            query`select lenflag from R_domainlen where  tld=${params.tld} and (minlen is null or minlen<=${params.len} ) and (maxlen is null or maxlen>=${params.len})`
            .then(ret=>{
                if(ret.length){ 
                    params.lenflag = ret[0].lenflag;
                }
                return query`select price from R_tblprice where gid=(select gid from G_tblopentld where gcode=${params.gcode} and tld=${params.tld}) and tld=${params.tld} and (years='' or years=${params.years}) and lenflag=${params.lenflag} and optype=${params.priceop} and startdatebj<=${params.curtime} and (enddatebj is null or enddatebj>${params.curtime})`;
            })
            .then(ret=>{
                if(!ret.length){
                    throw new Error("注册商级别或价格未登记");
                }
                params.gprice = ret[0].price;
                params.gfee = gprice * period * (-1);
                params.fee = price * period * (-1);
            });
            break;
    }
    return params;
}


class Bill extends Nodeway{
    constructor(uuid){
        super(uuid);
    }
    login(clID, pass, cb){
        let userInfo = {};

        query`select code,flag from sys_user where userid=${clID} and pwd=${encrypt(pass)}`
        .then(ret=>{
            userInfo.user = ret[0].code;
            userInfo.flag = ret[0].flag;
            userInfo.acl = {};
            return query`select distinct b.port from A_tblopentld a left join R_domain b on a.tld=b.tld where a.acode=${userInfo.user}`;
        })
        .then(ports=>{
            userInfo.acl.port = ports.map(p=>p.port);

            if(userInfo.flag != 'S') fillAcl(userInfo, cb);
            else {
                userInfo.acl.CreateDomain = [];
                userInfo.acl.DeleteDomain = [];
                userInfo.acl.RenewDomain = [];
                userInfo.acl.TransferDomain = [];
                userInfo.acl.RestoreDomain = [];
                cb(null, userInfo);
            }
        })
        .catch(cb);
    }
    passwd(clID, pass, cb){
        query`update sys_user set pwd=${encrypt(pass)} where userid=${clID}`
        .then(ret=>cb(null, !ret.length))
        .catch(cb);
    }
    cando(user, op, domain, period, cb){
        if (op == "create" && period < 2) {
            cb(new Error("最少注册两年"));
            return;
        }
        let flag = "0";
        let gprice = 0;  //组价格
        let aprice = 0;  //代理商价格
        let gfee = 0;
        let fee = 0;
        let lenflag = ''; //词性，目前只有“商城”才有值；否则就是空；
        let gcode = '';
        let curtime = util.getFullDate();
        let len = getdomainlen(domain);
        let tld = domain.split('.')[1];

        query`select gcode from A_tblopentld where acode=${acode} and tld=${tld}`
        .then(ret=>{
            if(!ret.length) throw new Error('系统中无此代理商账户或未开通此TLD'); // 用回调函数cb是不行的，因为后面的then还会继续执行。必须用throw抛错误，才能终止后面的then执行！！！
            gcode = ret[0].gcode;
            return query`select lenflag from R_domainlen where tld=${tld} and (minlen is null or minlen<=${len}) and (maxlen is null or maxlen>=${len})`
        })
        .then(ret=>{
            if(ret.length) lenflag = ret[0].lenflag;
            return query`select id  from sys_dictionary where flag=1 and ennm=${optype} and mark='1'`
        })
        .then(ret=>{
            if(ret.length) flag = '1';
            return query`select price from R_tblprice where gid in (select gid from G_tblopentld where gcode=${gcode} and tld=${tld}) and tld=${tld} and (years='' or years=${years}) and lenflag=${lenflag} and optype=${optype} and startdatebj<=${curtime} and (enddatebj is null or enddatebj>${curtime})`
        })
        .then(ret=>{
            if(!ret.length) throw new Error('注册商级别或价格未登记');
            gprice = ret[0].price;
            return query`select price from R_tblprice where gid in (select gid from G_tblopentld where acode=${acode} and tld=${tld}) and tld=${tld} and (years='' or years=${years}) and lenflag=${lenflag} and optype=${optype} and startdatebj<=${curtime} and (enddatebj is null or enddatebj>${curtime})`
        })
        .then(ret=>{
            if(!ret.length) throw new Error('代理商级别或价格未登记');
            aprice = ret[0].price;

            if(op != "autorenew"){
                if(flag == "0"){
                    gfee = gprice * period * (-1);
                    fee = aprice * period * (-1);
                }else{
                    gfee = gprice *  (-1);
                    fee = aprice *  (-1);
                }
            }
            return query`select balance from G_tblgroup where gcode=${gcode} and balance+${gfee}>=0`
        })
        .then(ret=>{
            if(!ret.length) throw new Error('注册商余额不足');
            return query`select balance from G_tblgroup where acode=${acode} and balance+${fee}>=0`
        })
        .then(ret=>{
            if(!ret.length) throw new Error('代理商余额不足');
            cb(null, aprice);
        })
        .catch(cb);
    }
    registry(id, cb) {
        this.cookie = id;
        cb(true);
    }
    done(user, op, domain, appID, registrant, opDate, price, period, exDate, oldID, uniID, cb){
       let params = {
            user: user,
            op: op.toLower(),
            registrant: registrant,
            period: period,
            exDate: exDate,
            curtime: getFullDate(), //当前系统时间
            uniID: this.cookie + '/' + uniID,           //uniID:本次流水的唯一值
            oldID: this.cookie + '/' + oldID,           // oldID:如为空，则扣费;如不为空，对应扣款时流水uniID
            acode: user,            //user: login时支付中心返回的用户ID
            optype: op,             //op: create/renew/autorenew/transferIn/transferOu/restore/delete/
            eppop: op,
            optypeold: op,          //delete是对应的消费类型
            domain: domain,         //domain:域名用汉字
            appID: appID,           //appID:为空，表示域名已经处于开放期；不为空，表示域名处于launch期。（launch期只涉及操作的时间和单价不同，相当于特定一段时间有一种特殊的价格）
            years: period,          //period:服务周期，数值范围1－10的整数 ;服务期限：>0表示扣费；<0表示退费
            roid: registrant,       //registrant:域名注册人ID
            opDate: opDate,         //opDate:操作时间（UTC时间）
            price: price,           //price:单价，为6.1.2 2）中支付中心返回的代理商该操作的单价（如为删除退费操作，则是oldID中扣费时的单价）
            toDate: exDate,         //exDate:域名到期日
            tld: domain.split(/\./)[1],
            lenflag: '',            //词性，计算组价格时要用
            priceop: op,            // 消费类型对应的消费类型价格,通常对应的是本消费类型定义的价格
            diffyears: period      //操作生效日与失效日之间的年差,通常等于period
        };
        let opLower = params.op;

        if( opLower === "transferin"){
            params.priceop = "transfer";
            params.optypeold = "transfer";
        }
        //首先检查此流水是否已经处理过了
        query`select uniID from R_Eppryde where uniID=${params.uniID}`
        .then(ret=>{
            if(ret.length){
                cb(null, true);
                //stop here.
            }
            return query`select gcode from A_tblopentld where acode=${params.acode} and tld=${params.tld}`;
        })        
        .then(ret=>{
            if(!ret.length){
                throw new Error('该代理商未开通此TLD:'+params.tld);
            }
            params.gcode = ret[0].gcode;

            if (period == 0){
                if (opLower == "transfer" || opLower == "restore" || opLower == "transferin" || opLower == "transferout"){
                    params.diffyears = 1;
                }
            }else{
                params = editParams(params);//ToDo: handl error throwed
                // handle transaction
                handle_transaction(params, cb);
            }
        })
        .catch(cb);
    }
    getAgent(domain, cb){
        let len = getdomainlen(domain);
        let tld = domain.split('.')[1];
        let WhoisEx = {};

        query`select lenflag from R_domainlen where tld=${tld} and (minlen is null or minlen<=${len}) and (maxlen is null or maxlen>=${len})`
        .then(type=>{
            type.length && (WhoisEx.type = type[0].lenflag);
            return query`select top 1 aname from R_Eppryde where domain=${domain} and optype<>'transferout' order by opdatebj desc`
        })
        .then(name=>{
            name.length && (WhoisEx.name = name[0].aname);
            cb(null, WhoisEx);
        }).catch(err=>{
            cb(err);
            util.mailto("getAgent "+err.message, () => {});
        });
    }
}

module.exports = Bill;
