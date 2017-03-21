const Nodeway = require('nodeway');
const sql = require('mssql');
const crypto = require('crypto');

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
	passwd(clID, pass){
        sql.query`update sys_user set pwd=${this.encrypt(pass)} where userid=${clID}`
        .then(ret=>console.log(ret));
	}
	cando(user, op, domain, period){
        
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
