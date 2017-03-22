const Nodeway = require('nodeway');
const sql = require('mssql');
const crypto = require('crypto');
const util = require('util.js');

class Bill extends Nodeway{
    constructor(uuid){
        super(uuid);
        this.conn = sql.connect("mssql://User:PWD@IP/DB");
    }
    login(clID, pass, cb){
	    this.conn.then(()=>{
	        sql.query`select code,flag from sys_user where userid=${clID} and pwd=${this.encrypt(pass)}`
        	.then(ret=>{
			    let userInfo = {};
				userInfo.user = ret[0].code;
				userInfo.flag = ret[0].flag;
				userInfo.acl = {};
				return userInfo;
		    })
		    .then(userInfo=>{
				sql.query`select distinct b.port from A_tblopentld a left join R_domain b on a.tld=b.tld where a.acode=${userInfo.user}`
			    .then(ports=>{
			   	    userInfo.acl.port = ports.map(p=>p.port);
			   	    let op = ['CreateDomain','DeleteDomain','RenewDomain','TransferDomain','RestoreDomain'];
			   	        op.map(o=>userInfo.acl[o]=[]);
			   	  
			   	    if(userInfo.flag != 'S'){
			   	    	sql.query`select tld from A_tblopentld where acode=${userInfo.user} and CreateDomain=0`
			   	    	.then(tld=>{
			   	    		userInfo.acl.CreateDomain = tld.map(t=>t.tld);
			   	    	})
			   	    	.then(()=>{
			   	    		sql.query`select tld from A_tblopentld where acode=${userInfo.user} and DeleteDomain=0`
			   	    	    .then(tld=>{
			   	    	    	userInfo.acl.DeleteDomain = tld.map(t=>t.tld);//this.emit("data", tld);
			   	    	    })
			   	    	})
			   	    	.then(()=>{
		   	    	    	sql.query`select tld from A_tblopentld where acode=${userInfo.user} and RenewDomain=0`
		       	    	    .then(tld=>{
		       	    	    	userInfo.acl.RenewDomain = tld.map(t=>t.tld);
		       	    	    })
		       	    	})
			       	    .then(()=>{
	       	    	    	sql.query`select tld from A_tblopentld where acode=${userInfo.user} and TransferDomain=0`
	   	    	            .then(tld=>{
	   	    		            userInfo.acl.TransferDomain = tld.map(t=>t.tld);
	   	    		        })
	   	    		    })
			   	    	.then(()=>{
   	    		            sql.query`select tld from A_tblopentld where acode=${userInfo.user} and RestoreDomain=0`
   	    	                .then(tld=>{
   	                   		    userInfo.acl.RestoreDomain = tld.map(t=>t.tld);
   	                   		    cb(null, userInfo);
                                this.emit("data", userInfo);
			   	            });
			   	        });
			   	    }else{
			   	    	cb(null, userInfo);
                        this.emit("data", userInfo);
			   	    }
			    })
			})
		    .catch(err=>console.log(err));
		}).catch(err=>console.log(err));
	}
	passwd(clID, pass, cb){
	    this.conn.then(()=>{
            sql.query`update sys_user set pwd=${this.encrypt(pass)} where userid=${clID}`
            .then(ret=>{
                cb(null, !ret);
                this.emit('data', !ret);
            }).catch(err=>{
                cb(err, null);
            });
        });
	}
	cando(user, op, domain, period,cb){
            if (op == "create" && period < 2) {
            cb(new Error("最少注册两年"), null);
            return;
        }
        let flag = "0";
        let gprice = 0;  //组价格
        let aprice = 0;  //代理商价格
        let lenflag = ''; //词性，目前只有“商城”才有值；否则就是空；
        let gcode = ''
        let curtime = util.getFullDate();

        this.conn.then(()=>{
            let len = this.getdomainlen(domain);
            let tld = domain.split(/\./)[1];

            //首先得到组ID并检查是否代理商是否开通了此TLD
            sql.query`select gcode from A_tblopentld where acode=${acode} and tld=${tld}`
            .then(ret=>{
                if(!ret){
                    cb(new Error('系统中无此代理商账户或未开通此TLD'),null);
                }else{
                    gcode = ret[0].gcode;
                }
            });

            //判断域名的词性（目前只有“商城”才有值；否则就是空；，但以后也许其它域名也有区分，所以按参数表都判断一下）
            sql.query`select lenflag from R_domainlen where tld=${tld} and (minlen is null or minlen<=${len}) and (maxlen is null or maxlen>=${len})`
            .then(ret=>{
                if(ret) lenflag = ret[0].lenflag;
            });
        })
        .then(()=>{
            //检查操作的付费标志 表sys_dictionary中flag=1 是登记操作类型，其中 mark=1 表示一年收费，0为按年收费
            sql.query`select id  from sys_dictionary where flag=1 and ennm=${optype} and mark='1' `
            .then(ret=>{
                if(ret) flag = '1';
            });

            //（首先取组价格）
            sql.query`select price from R_tblprice where gid in (select gid from G_tblopentld where gcode=${gcode} and tld=${tld}) and tld=${tld} and (years='' or years=${years}) and lenflag=${lenflag} and optype=${optype} and startdatebj<=${curtime} and (enddatebj is null or enddatebj>${curtime})`
            .then(ret=>{
                if(!ret){
                    cb(new Error('注册商级别或价格未登记'),null);
                }else{
                    gprice = ret[0].price;
                }
            });

            //获得本代理商的价格
            sql.query`select price from R_tblprice where gid in (select gid from G_tblopentld where acode=${acode} and tld=${tld}) and tld=${tld} and (years='' or years=${years}) and lenflag=${lenflag} and optype=${optype} and startdatebj<=${curtime} and (enddatebj is null or enddatebj>${curtime})`
            .then(ret=>{
                if(!ret){
                    cb(new Error('代理商级别或价格未登记'),null);
                }else{
                    aprice = ret[0].price;
                }
            });
        })
        .then(()=>{
            let gfee,fee;
            if(op != "autorenew"){
                if(flag == "0"){
                    gfee = gprice * period * (-1);
                    fee = aprice * period * (-1);
                }else{
                    gfee = gprice *  (-1);
                    fee = aprice *  (-1);
                }
            }
            //组余额
            sql.query`select balance from G_tblgroup where gcode=${gcode} and balance+${gfee}>=0`
            .then(ret=>{
                if(!ret){
                    cb(new Error('注册商余额不足'), null);
                }
            });
            //代理商余额
            sql.query`select balance from G_tblgroup where acode=${acode} and balance+${fee}>=0`
            .then(ret=>{
                if(!ret){
                    cb(new Error('代理商余额不足'), null);
                }
            })
        })
        .then((){
            cb(null, aprice);
            this.emit('data', aprice);
        })
        .catch(err=>{
            // sendEmail(err);
            cb(err, null);
        }); 
	}
	done(usr,op,domain,appID,registrant,opDate,price,period,exDate,oldID,uniID){

	}
	getAgent(domain, cb){
        let len = this.getdomainlen(domain);
        let tld = domain.split(/\./)[1];
        let WhoisEx = {};
        this.conn.then(()=>{
            sql.query`select lenflag from R_domainlen where tld=${tld} and (minlen is null or minlen<=${len}) and (maxlen is null or maxlen>=${len})`
            .then(type=>{
                type && (WhoisEx.type = type);

                // 得到该域名最后一条记录的代理商
                sql.query`select top 1 aname from R_Eppryde where domain=${domain} and optype<>'transferout' order by opdatebj desc`
                .then(name=>{
                    name && (WhoisEx.name = name);
                    cb(null, WhoisEx);
                    this.emit('data', WhoisEx);
                });
            }).catch(err=>{
                cb(err, null);
                // this.emit('data', null);
                // sendEmail(ex.message, "getAgent");
            })
        });
    }
    getdomainlen(domain){
        let len = 0;
        let s = domain.substring(0, domain.IndexOf("."));
        for (let i = 0; i < s.Length; i++){
            if (s.charAt(i) <= 0xff) len += 1;
            else len += 2;
        }
        return len;
    }
	encrypt(pass){
        let hash = crypto.createHash('md5');
            hash.update(pass,'utf16le');
        let pwd = hash.digest('hex').split('').map((v,i)=>i%2 != 0? v+'-':v);
        return pwd.join('').toUpperCase().slice(0,-1);
    }
}

			   	    
module.exports = Bill;
