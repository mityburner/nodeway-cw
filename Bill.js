const Nodeway = require('nodeway');
const sql = require('mssql');

class Bill extends Nodeway{
    constructor(uuid){
        super(uuid);
        this.conn = sql.connect("mssql://User:PWD@IP/DB");
    }
    login(clID, pass, cb){
	    this.conn.then(()=>{
	        sql.query`select code,flag from sys_user where userid=${clID} and pwd=${pass}`
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
        sql.query`update sys_user set pwd=${pass} where userid=${clID}`
        .then(ret=>console.log(ret));
	}
	cando(user, op, domain, period){
        
	}
	done(usr,op,domain,appID,registrant,opDate,price,period,exDate,oldID,uniID){

	}
	getAgent(domain){

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
}

			   	    
module.exports = Bill;
