using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.UI;
using System.Web.UI.WebControls;
using System.Web.Script.Serialization;
using System.Collections;
using System.Data;
using System.Data.SqlClient;
using System.Configuration;
using LitJson;

namespace Epp.Web
{
    struct ACL
    {
        public string[] port;
        public string[] CreateDomain;
        public string[] DeleteDomain;
        public string[] RenewDomain;
        public string[] TransferDomain;
        public string[] RestoreDomain;
    }
    struct UserInfo
    {
        public string user;
        public ACL acl;
    }
    struct WhoisEx
    {
        public string name;
        public string type;
    }
    public partial class Index : System.Web.UI.Page
    {
        protected void Page_Load(object sender, EventArgs e)
        {
            Response.ContentType = "application/json";
            Response.Write(_getParamSet());
            Response.End();
        }
        #region toJson
        private string stringify(bool b)
        {
            return b.ToString().ToLower();
        }
        private string stringify(int i)
        {
            return i.ToString();
        }
        private string stringify(string s)
        {
            return "\"" + s + "\"";
        }
        private string stringify(object o)
        {
            return JsonMapper.ToJson(o);
        }
        #endregion
        private string _getParamSet()
        {
            try
            {
                string IP = Request.ServerVariables["REMOTE_ADDR"];
                if (!string.Equals(IP, "112.124.47.75") && !string.Equals(IP, "115.29.242.206") && !string.Equals(IP, "124.207.11.114") && false) //&& false
                {
                    throw new Exception(IP + " deny");
                }
                return getParamsSet();
            }
            catch (Exception ex)
            {
                return ex.Message;
            }
            //catch 
            //{
            //    return null;   // JsonMapper.ToJson(null);
            //}  
        }
        private string getParamsSet()
        {
            switch (Request.Form["command"].ToString())
            {
                case "login":
                    return stringify(login(
                             Request.Form["user"].ToString(),
                             Request.Form["pass"].ToString()
                           ));
                case "passwd":
                    return stringify(passwd(
                             Request.Form["user"].ToString(),
                             Request.Form["pass"].ToString()
                           ));
                case "cando":
                    return stringify(cando(
                             Request.Form["user"].ToString(),
                             Request.Form["op"].ToString(),
                             Request.Form["domain"].ToString(),
                             Convert.ToInt16(Request.Form["period"].ToString())
                           ));
                case "done":
                    if (Request.Cookies["payment_epp_sessionid"] == null)
                    {
                        throw new Exception("Cookies[payment_epp_sessionid]不存在");
                    }
                    else
                    {
                        return stringify(done(
                                 Request.Form["user"].ToString(),
                                 Request.Form["op"].ToString(),
                                 Request.Form["domain"].ToString(),
                                 Request.Form["appID"].ToString(),
                                 Request.Form["registrant"].ToString(),
                                 Request.Form["opDate"].ToString(),
                                 Convert.ToInt32(Request.Form["price"].ToString()),
                                 Convert.ToInt16(Request.Form["period"].ToString()),
                                 Request.Form["exDate"].ToString(),
                                 Request.Cookies["payment_epp_sessionid"].Value + "/" + Request.Form["oldID"].ToString(),
                                 Request.Cookies["payment_epp_sessionid"].Value + "/" + Request.Form["uniID"].ToString()
                            //Request.Form["oldID"].ToString(),
                            //Request.Form["uniID"].ToString()
                               ));
                    }
                case "getAgent":
                    return stringify(getAgent(
                             Request.Form["domain"].ToString()
                           ));
                default:
                    throw new Exception("OP undefined");
            }
        }
        private UserInfo login(string clID, string pass)
        {
                bool SysErr = true;
                SqlConnection connection = new SqlConnection(ConfigurationManager.ConnectionStrings["ConnStr"].ConnectionString);
                connection.Open();  
                try
                {
                    UserInfo info = new UserInfo();
                    SqlCommand command = new SqlCommand("", connection);
                    command.Parameters.Add(new SqlParameter("@userid", clID));      //clID: 代理商别名
                    command.Parameters.Add(new SqlParameter("@pwd", EncryptPassword(pass)));
                    command.CommandText = "select code,flag from sys_user where userid=@userid and pwd=@pwd ";
                    SqlDataReader rs = command.ExecuteReader();
                    if (!rs.Read())
                    {
                        SysErr = false;
                        throw new Exception("用户不存在或用户密码错误");
                    }
                    info.user = rs["code"].ToString();
                    string flag = rs["flag"].ToString();
                    rs.Close();

                        info.acl = new ACL();
                        ArrayList port = new ArrayList();
                        command.Parameters.Add(new SqlParameter("@acode", info.user));
                        command.CommandText = "select distinct b.port from A_tblopentld a left join R_domain b on a.tld=b.tld where a.acode=@acode ";
                        rs = command.ExecuteReader();
                        while (rs.Read())
                        {
                            port.Add(rs["port"].ToString());
                        }
                        rs.Close();
                        info.acl.port = new string[port.Count];
                        port.CopyTo(info.acl.port);

                        if (flag != "S") //盛名用户'S'，模拟代理商，只返回代理商ID
                        {
                            ArrayList CreateDomain = new ArrayList();
                            command.CommandText = "select tld from A_tblopentld where acode=@acode and CreateDomain=0 ";
                            rs = command.ExecuteReader();
                            while (rs.Read())
                            {
                                CreateDomain.Add(rs["tld"].ToString());
                            }
                            rs.Close();
                            info.acl.CreateDomain = new string[CreateDomain.Count];
                            CreateDomain.CopyTo(info.acl.CreateDomain);

                            ArrayList DeleteDomain = new ArrayList();
                            command.CommandText = "select tld from A_tblopentld where acode=@acode and DeleteDomain=0 ";
                            rs = command.ExecuteReader();
                            while (rs.Read())
                            {
                                DeleteDomain.Add(rs["tld"].ToString());
                            }
                            rs.Close();
                            info.acl.DeleteDomain = new string[DeleteDomain.Count];
                            DeleteDomain.CopyTo(info.acl.DeleteDomain);

                            ArrayList RenewDomain = new ArrayList();
                            command.CommandText = "select tld from A_tblopentld where acode=@acode and RenewDomain=0 ";
                            rs = command.ExecuteReader();
                            while (rs.Read())
                            {
                                RenewDomain.Add(rs["tld"].ToString());
                            }
                            rs.Close();
                            info.acl.RenewDomain = new string[RenewDomain.Count];
                            RenewDomain.CopyTo(info.acl.RenewDomain);

                            ArrayList TransferDomain = new ArrayList();
                            command.CommandText = "select tld from A_tblopentld where acode=@acode and TransferDomain=0 ";
                            rs = command.ExecuteReader();
                            while (rs.Read())
                            {
                                TransferDomain.Add(rs["tld"].ToString());
                            }
                            rs.Close();
                            info.acl.TransferDomain = new string[TransferDomain.Count];
                            TransferDomain.CopyTo(info.acl.TransferDomain);

                            ArrayList RestoreDomain = new ArrayList();
                            command.CommandText = "select tld from A_tblopentld where acode=@acode and RestoreDomain=0 ";
                            rs = command.ExecuteReader();
                            while (rs.Read())
                            {
                                RestoreDomain.Add(rs["tld"].ToString());
                            }
                            rs.Close();
                            info.acl.RestoreDomain = new string[RestoreDomain.Count];
                            RestoreDomain.CopyTo(info.acl.RestoreDomain);
                        }
                        else
                        {
                            info.acl.CreateDomain = new string[0];
                            info.acl.DeleteDomain = new string[0];
                            info.acl.RenewDomain = new string[0];
                            info.acl.TransferDomain = new string[0];
                            info.acl.RestoreDomain = new string[0];

                        }
                    connection.Close();
                    return info;
                }
                catch (Exception ex)
                {
                    connection.Close();     
                     //如果是系统异常发邮件
                    if (SysErr)
                    {
                         sendmail(ex.Message,"login");
                    }
                    throw new Exception(ex.Message);
                }
         }
        private bool passwd(string clID, string pass)
        {
            SqlConnection connection = new SqlConnection(ConfigurationManager.ConnectionStrings["ConnStr"].ConnectionString);
            connection.Open();
            SqlCommand command = new SqlCommand("update sys_user set pwd=@pwd where userid=@userid", connection);
            command.Parameters.Add(new SqlParameter("@userid", clID));      //clID 登录别名
            command.Parameters.Add(new SqlParameter("@pwd", EncryptPassword(pass)));
            var fail = command.ExecuteNonQuery() == 0;
            connection.Close();
            return !fail;            
        }
        private int cando(string user, string op, string domain, int period)
        {
            if (op == "create" && period < 2) {
                throw new Exception("最少注册两年");
            }
            bool SysErr = true;
            SqlConnection connection = new SqlConnection(ConfigurationManager.ConnectionStrings["ConnStr"].ConnectionString);
            connection.Open();
            try
            {
                SqlCommand command = new SqlCommand("", connection);
                command.Parameters.Add(new SqlParameter("@acode", user));
                command.Parameters.Add(new SqlParameter("@optype", op));
                command.Parameters.Add(new SqlParameter("@tld", domain.Substring(domain.IndexOf(".") + 1)));
                command.Parameters.Add(new SqlParameter("@lenflag", "")); //词性，目前只有“商城”才有值；否则就是空；
                command.Parameters.Add(new SqlParameter("@years", period));
                command.Parameters.Add(new SqlParameter("@curtime", DateTime.Now));
                command.Parameters.Add(new SqlParameter("@gcode", ""));

                object obj;
                string flag = "0";
                int gprice = 0;    //组价格
                int aprice = 0;    //代理商价格

                //首先得到组ID并检查是否代理商是否开通了此TLD
                command.CommandText = "select gcode from A_tblopentld where acode=@acode and tld=@tld";
                obj = command.ExecuteScalar();
                if (obj == null)
                {
                    SysErr = false;
                    throw new Exception("系统中无此代理商账户或未开通此TLD");
                }
                command.Parameters["@gcode"].Value = obj.ToString();

                //判断域名的词性（目前只有“商城”才有值；否则就是空；，但以后也许其它域名也有区分，所以按参数表都判断一下）
                int len = getdomainlen(domain);
                command.Parameters.Add(new SqlParameter("@len", len));
                command.CommandText = "select lenflag from R_domainlen where tld=@tld and (minlen is null or minlen<=@len) and (maxlen is null or maxlen>=@len)";
                obj = command.ExecuteScalar();
                if (obj != null)
                {
                    command.Parameters["@lenflag"].Value = obj.ToString();
                }

                //检查操作的付费标志 表sys_dictionary中flag=1 是登记操作类型，其中 mark=1 表示一年收费，0为按年收费
                command.CommandText = "select id  from sys_dictionary where flag=1 and ennm=@optype and mark='1' ";
                if (command.ExecuteScalar() != null)
                {
                    flag = "1";
                }

                //（首先取组价格）
                command.CommandText = "select price from R_tblprice where gid in (select gid from G_tblopentld where gcode=@gcode and tld=@tld) and tld=@tld and (years='' or years=@years) and lenflag=@lenflag and optype=@optype and startdatebj<=@curtime and (enddatebj is null or enddatebj>@curtime)";
                //SqlDataReader rs = command.ExecuteReader();
                obj = command.ExecuteScalar();
                if (obj == null)
                {
                    SysErr = false;
                    throw new Exception("注册商级别或价格未登记");
                }
                gprice = int.Parse(obj.ToString());

                //获得本代理商的价格
                command.CommandText = "select price from R_tblprice where gid=(select gid from A_tblopentld where acode=@acode and tld=@tld) and tld=@tld and (years='' or years=@years) and lenflag=@lenflag and optype=@optype and startdatebj<=@curtime and (enddatebj is null or  enddatebj>@curtime) ";
                obj = command.ExecuteScalar();
                if (obj == null)
                {
                    SysErr = false;
                    throw new Exception("代理商级别或价格未登记");
                }
                else
                {
                    aprice = int.Parse(obj.ToString());
                }

                //下面计算余额是否足够支付 自动续费不看余额
                if (op != "autorenew")
                {

                    if (flag == "0") //按年收费
                    {
                        command.Parameters.Add(new SqlParameter("@gfee", gprice * period * (-1)));
                        command.Parameters.Add(new SqlParameter("@fee", aprice * period * (-1)));
                    }
                    else
                    {
                        command.Parameters.Add(new SqlParameter("@gfee", gprice * (-1)));
                        command.Parameters.Add(new SqlParameter("@fee", aprice * (-1)));
                    }
                    //组余额
                    command.CommandText = "select balance from G_tblgroup where gcode=@gcode and balance+@gfee>=0";
                    if (command.ExecuteScalar() == null)
                    {
                        SysErr = false;
                        throw new Exception("注册商余额不足");
                    }
                    //代理商余额
                    command.CommandText = "select balance from A_tblagent where acode=@acode and balance+@fee>=0";
                    if (command.ExecuteScalar() == null)
                    {
                        SysErr = false;
                        throw new Exception("代理商余额不足");
                    }
                }
                connection.Close();
                return aprice;
        
                //command.Parameters.Add(new SqlParameter("@baseprice", baseprice));
                //获得组的价格 如果组的价格是折扣，直接用基础价格算出本组的价格
                //command.CommandText = "select (case when discount is null then price else ROUND(@baseprice*discount,0) end) from G_tblprice where gcode=@gcode and tld=@tld  and lenflag=@lenflag and optype=@optype and startdatebj<=@curtime and (enddatebj is null or enddatebj>=@curtime) ";
                //obj = command.ExecuteScalar();
            }
            catch (Exception ex)
            {
                connection.Close();
                if (SysErr)
                {
                    sendmail(ex.Message,"cando");
                }
                throw new Exception(ex.Message);
            }
        }
        private bool done(string user, string op, string domain, string appID, string registrant, string opDate, int price, int period, string exDate, string oldID, string uniID)
        {
            
            bool SysErr = true;
            SqlConnection connection = new SqlConnection(ConfigurationManager.ConnectionStrings["ConnStr"].ConnectionString);
            connection.Open();
            try
            {
                SqlCommand command = new SqlCommand("", connection);
                string tld = domain.Substring(domain.IndexOf(".") + 1);
                command.Parameters.Add(new SqlParameter("@curtime", DateTime.Now));//当前系统时间
                command.Parameters.Add(new SqlParameter("@uniID", uniID));     //uniID:本次流水的唯一值
                command.Parameters.Add(new SqlParameter("@oldID", oldID));     // oldID:如为空，则扣费;如不为空，对应扣款时流水uniID
                command.Parameters.Add(new SqlParameter("@acode", user));      //user: login时支付中心返回的用户ID
                command.Parameters.Add(new SqlParameter("@optype", op));       //op: create/renew/autorenew/transferIn/transferOu/restore/delete/
                command.Parameters.Add(new SqlParameter("@eppop", op));
                command.Parameters.Add(new SqlParameter("@optypeold", op));   //delete是对应的消费类型
                command.Parameters.Add(new SqlParameter("@domain", domain));   //domain:域名用汉字
                command.Parameters.Add(new SqlParameter("@appID", appID));     //appID:为空，表示域名已经处于开放期；不为空，表示域名处于launch期。（launch期只涉及操作的时间和单价不同，相当于特定一段时间有一种特殊的价格）
                command.Parameters.Add(new SqlParameter("@years", period));    //period:服务周期，数值范围1－10的整数 ;服务期限：>0表示扣费；<0表示退费
                command.Parameters.Add(new SqlParameter("@roid", registrant)); //registrant:域名注册人ID
                command.Parameters.Add(new SqlParameter("@opDate", opDate));   //opDate:操作时间（UTC时间）
                command.Parameters.Add(new SqlParameter("@price", price));     //price:单价，为6.1.2 2）中支付中心返回的代理商该操作的单价（如为删除退费操作，则是oldID中扣费时的单价）
                command.Parameters.Add(new SqlParameter("@toDate", exDate));   //exDate:域名到期日
                command.Parameters.Add(new SqlParameter("@tld", tld));//得到TLD
                command.Parameters.Add(new SqlParameter("@lenflag", "")); //词性，计算组价格时要用
                command.Parameters.Add(new SqlParameter("@priceop", op));        // 消费类型对应的消费类型价格,通常对应的是本消费类型定义的价格
                command.Parameters.Add(new SqlParameter("@diffyears", period));  //操作生效日与失效日之间的年差,通常等于period

                string opLower = op.ToLower();

                if (opLower == "transferin")
                {
                    command.Parameters["@priceop"].Value = "transfer";
                    command.Parameters["@optypeold"].Value = "transfer";
                }

                object obj;
                //string flag = "0";//记录计费方式（0-按年，1-一年)
                //首先检查此流水是否已经处理过了
                command.CommandText = "select uniID from R_Eppryde where uniID=@uniID";
                obj = command.ExecuteScalar();
                if (obj != null)
                {
                    return true;
                }
                //首先得到组ID并检查是否开通了此TLD
                command.CommandText = "select gcode from A_tblopentld where acode=@acode and tld=@tld";
                obj = command.ExecuteScalar();
                if (obj == null)
                {
                    SysErr = false;
                    throw new Exception("该代理商未开通此TLD:" + tld);
                }
                command.Parameters.Add(new SqlParameter("@gcode", obj.ToString()));

                int gprice = 0;
                int gfee = 0;
                int fee = 0;

                //操作生效时间：为exDate时间扣除年限period所指的年数的时间修改为：
                //1）当命令为transfer或restore且period＝0时，操作生效时间为exDate时间向前推一年；
                //2）其它情况下仍为操作生效时间：为exDate时间扣除年限period所指的年数的时间。
                if (period == 0)
                {
                    if (opLower == "transfer" || opLower == "restore" || opLower == "transferin" || opLower == "transferout")
                    {
                        command.Parameters["@diffyears"].Value = 1;
                    }
                }
                else
                {
                    switch (opLower)
                    {
                        case "transferout"://transferout不用询组价，不扣费
                            command.Parameters["@optypeold"].Value = "transfer";
                            break;
                        case "delete"://转换op 并得到原组退费价格
    
                                command.CommandText = "select eppop,gprice,gfee,fee from R_Eppryde where uniID=@oldID";
                                SqlDataReader rs = command.ExecuteReader();
                                if (!rs.Read())
                                {
                                    SysErr = false;
                                    throw new Exception("无原始记录");
                                }
                                gprice = int.Parse(rs["gprice"].ToString());
                                gfee = (-1) * int.Parse(rs["gfee"].ToString());
                                fee = (-1) * int.Parse(rs["fee"].ToString());
                                switch (rs["eppop"].ToString())
                                {
                                    case "create":
                                        command.Parameters["@optypeold"].Value = "create";
                                        command.Parameters["@optype"].Value = "agp-deletedrawback";//oldID中的op为create，表示创建在AGP期删除
                                        break;
                                    case "autorenew":
                                        command.Parameters["@optypeold"].Value = "autorenew";
                                        command.Parameters["@optype"].Value = "au-deletedrawback"; //oldID中的op为autorenew，表示自动续费后在自动续费期删除了域名退费
                                        break;
                                }
                                rs.Close();
                           
                            break;
                        default:
                            //判断域名的词性（目前只有“商城”才有值；否则就是空；，但以后也许其它域名也有区分，所以按参数表都判断一下）
                            int len = getdomainlen(domain);
                            command.Parameters.Add(new SqlParameter("@len", len));
                            command.CommandText = "select lenflag from R_domainlen where  tld=@tld and (minlen is null or minlen<=@len ) and (maxlen is null or maxlen>=@len)";
                            obj = command.ExecuteScalar();
                            if (obj != null)
                            {
                                command.Parameters["@lenflag"].Value = obj.ToString();
                            }


                            ////检查操作的付费标志 表sys_dictionary中flag=1 是登记操作类型，其中 mark=1 表示一年收费，0为按年收费
                            //command.CommandText = "select mark from sys_dictionary where flag=1 and ennm=@optype and mark='1'";
                            ////SqlDataReader rs1 = command.ExecuteReader();
                            //if (command.ExecuteScalar() != null)
                            //{
                            //    flag = "1";
                            //}
                            //（首先取组价格）
                            command.CommandText = "select price from R_tblprice where gid=(select gid from G_tblopentld where gcode=@gcode and tld=@tld) and tld=@tld and (years='' or years=@years) and lenflag=@lenflag and optype=@priceop and startdatebj<=@curtime and (enddatebj is null or enddatebj>@curtime)";
                            obj = command.ExecuteScalar();
                            if (obj == null)
                            {
                                SysErr = false;
                                throw new Exception("注册商级别或价格未登记");
                            }
                            else
                            {
                                gprice = int.Parse(obj.ToString());
                                gfee = gprice * period * (-1);
                                fee = price * period * (-1); //－代理商单价*年限(年限>0 要扣代理商的钱，年限<0要退代理商的钱）

                                //if (flag == "0") //按年收费
                                //{
                                //    gfee = gprice * period * (-1);
                                //    fee = price * period * (-1); //－代理商单价*年限(年限>0 要扣代理商的钱，年限<0要退代理商的钱）
                                //}
                                //else
                                //{
                                //    //收一年的费用
                                //    gfee = gprice * (-1);
                                //    fee = price * (-1);
                                //}

                            }
                            break;
                    }
                }
                //得到组费用 代理商费用
                command.Parameters.Add(new SqlParameter("@gprice", gprice));
                command.Parameters.Add(new SqlParameter("@gfee", gfee));
                command.Parameters.Add(new SqlParameter("@fee", fee));
                
                command.Transaction = connection.BeginTransaction();
                try
                {
                    //2016/3/31 add the params into the table EPP_api
                    string _params = "user=" + user + ";op=" + opLower + ";domain=" + domain + ";appID=" + appID + ";registrant=" + registrant + ";opDate=" + opDate + ";price=" + price + ";period=" + period + ";exDate=" + exDate + ";oldID=" + oldID + ";uniID=" + uniID;
                    command.CommandText = "insert into EPP_api values('done','" + _params + "')";
                    command.ExecuteNonQuery();
                    //end

                    command.CommandText = "insert into R_eppryde(splitdate,uniID,oldID,acode,eppop,optypeold,optype,domain,tld,appID,years,roid,opDate,price,gprice,toDate,fee,gfee,gcode,gname,aname,fromdate,opdatebj,fromdatebj,todatebj) select dateadd(hh, 8, @opdate),@uniID,@oldID,@acode,@eppop,@optypeold,@optype,@domain,@tld,@appID,@years,@roid,@opDate,@price,@gprice,@toDate,@fee,@gfee,gcode,gname,aname,dateadd(yyyy,abs(@diffyears)*(-1),@todate),dateadd(hh, 8, @opdate),dateadd(hh,8,dateadd(yyyy,abs(@diffyears)*(-1),@todate)),dateadd(hh,8,@todate) from View_A_tblagent where acode=@acode";
                    command.ExecuteNonQuery();

                    //不含税消费,计算增值税
                    if (opLower!= "delete")
                    {
                        command.CommandText = "update R_eppryde set notaxfee=a.gfee/(1+b.tax) from R_eppryde a left join R_tbltax b on ( b.startdate is null or a.opdatebj>= b.startdate) and (b.enddate is null or a.opdatebj<b.enddate) where a.uniID=@uniID";
                        command.ExecuteNonQuery();
                        command.CommandText = "update R_eppryde set addtax=gfee-notaxfee where uniID=@uniID";
                        command.ExecuteNonQuery();
                    }
                    else
                    {
                        command.CommandText = "update a set a.notaxfee=(-1)*b.notaxfee,a.addtax=(-1)*b.addtax from R_eppryde a left join R_eppryde b on a.oldID=b.uniID where a.uniID=@uniID"; 
                        command.ExecuteNonQuery();
                    }
                    //关于两条合并,申请记录重新填写fromdatebj,用这个做分摊
                    if (opLower == "transferin" || opLower == "restore") 
                    {
                        if (period > 0) //申请
                        {
                            command.CommandText = "update R_eppryde set splitdate=null where uniID=@uniID";
                            command.ExecuteNonQuery();
                        }
                        else
                        {
                            //if (period <= 0)//审批成功,或失败
                            //{
                                command.CommandText = "update R_eppryde set splitdate=b.opdatebj,fromdate=b.fromdate,todate=b.todate,fromdatebj=b.fromdatebj,todatebj=b.todatebj from R_eppryde a left join  (select oldid,opdatebj,fromdate,fromdatebj,todate,todatebj from R_eppryde where uniid=@uniid) b on a.uniid=b.oldid where a.uniID=@oldID and b.oldID=@oldID";
                                command.ExecuteNonQuery();
                            //}
                        }
                    }

                    //测试，不扣扣费
                    if (tld != "hdaotest")
                    {
                        //扣商代费用
                        command.CommandText = "update  A_tblagent set balance=balance+@fee  where acode=@acode";
                        command.ExecuteNonQuery();

                        //扣除组费用
                        command.CommandText = "update  G_tblgroup set balance=balance+@gfee  where gcode=@gcode";
                        command.ExecuteNonQuery();
                    }
                    command.Transaction.Commit();
                    connection.Close();
                    return true;
                }
                catch (Exception ex)
                {
                    command.Transaction.Rollback();
                    throw new Exception(ex.Message);
                }
            }
            catch (Exception ex)
            {
                connection.Close();
                if (SysErr)
                {
                    sendmail(ex.Message,"done");
                }
                throw new Exception(ex.Message);
            }
                //return false;
        }
        private WhoisEx getAgent(string domain)
        {
            SqlConnection connection = new SqlConnection(ConfigurationManager.ConnectionStrings["ConnStr"].ConnectionString);
            connection.Open();
            try
            {
                SqlCommand command = new SqlCommand("", connection);

                WhoisEx info = new WhoisEx();
                object obj;

                command.Parameters.Add(new SqlParameter("@len", getdomainlen(domain)));
                command.Parameters.Add(new SqlParameter("@tld", domain.Substring(domain.IndexOf(".") + 1)));
                command.CommandText = "select lenflag from R_domainlen where tld=@tld and (minlen is null or minlen<=@len) and (maxlen is null or maxlen>=@len)";
                obj = command.ExecuteScalar();
                if (obj != null)
                {
                    info.type = obj.ToString();
                }

                // 得到该域名最后一条记录的代理商
                command.Parameters.Add(new SqlParameter("@domain", domain));
                command.CommandText = "select top 1 aname from R_Eppryde where domain=@domain and optype<>'transferout' order by opdatebj desc";
                obj = command.ExecuteScalar();
                if (obj != null)
                {
                    info.name = obj.ToString();
                }
                connection.Close();
                return info;
            }
            catch (Exception ex)
            {
                connection.Close();
                sendmail(ex.Message,"getAgent");
                throw new Exception(ex.Message);
            }
        }
        private int getdomainlen(string domain)
        {
            int len = 0;
            string s = domain.Substring(0, domain.IndexOf("."));
            for (int i = 0; i < s.Length; i++)
            {
                if (s.ElementAt(i) <= 0xff) len += 1;
                else len += 2;
            }
            return len;
        }
        private string EncryptPassword(string pass)
        {
             Byte[] clearBytes = new System.Text.UnicodeEncoding().GetBytes(pass);
             Byte[] hashedBytes = ((System.Security.Cryptography.HashAlgorithm)System.Security.Cryptography.CryptoConfig.CreateFromName("MD5")).ComputeHash(clearBytes); ;
             return BitConverter.ToString(hashedBytes); 
        }
        //发邮件通知
        private bool sendmail(string err,string source)
        {
            try
            {
                SqlConnection connection = new SqlConnection(ConfigurationManager.ConnectionStrings["ConnStr"].ConnectionString);
                connection.Open();
                SqlCommand command = new SqlCommand("", connection);
                try
                {
                    command.CommandText = "select para from SYS_PARA where id=6";//读取预警邮箱
                    String promptmailbox = "";
                    Object obj = command.ExecuteScalar();
                    if (obj == null)
                    {
                        promptmailbox = "";
                    }
                    else
                    {
                        promptmailbox = obj.ToString().Trim();
                    }
                    if (promptmailbox == "")
                    {
                        throw new Exception("提醒邮箱未设置,系统错误不能邮件提醒");
                    }
                    else
                    {
                        string mailserver = "";
                        string mailuser = "";
                        string mailpwd = "";
                        int mailport = 0;
                        string nameStr = "";
                        command.CommandText = "select top 1 * from SYS_mailserver order by keys desc";
                        SqlDataReader rs = command.ExecuteReader();
                        if (rs.Read())
                        {
                            nameStr = rs["name"].ToString();
                            mailserver = rs["mailserver"].ToString();
                            mailuser = rs["mailuser"].ToString();
                            mailpwd = rs["mailpwd"].ToString();
                            mailport = int.Parse(rs["mailport"].ToString());
                            rs.Close();
                            System.Net.Mail.MailMessage MyMail = new System.Net.Mail.MailMessage();
                            MyMail.From = new System.Net.Mail.MailAddress(mailuser, nameStr, System.Text.Encoding.UTF8);
                            MyMail.Subject = "接口报错";
                            MyMail.Priority = System.Net.Mail.MailPriority.Normal;
                            MyMail.SubjectEncoding = System.Text.Encoding.UTF8;
                            MyMail.IsBodyHtml = true;
                            System.Net.Mail.SmtpClient smtp = new System.Net.Mail.SmtpClient(mailserver, mailport);
                            smtp.EnableSsl = true;
                            smtp.UseDefaultCredentials = false;
                            smtp.Credentials = new System.Net.NetworkCredential(mailuser, mailpwd);
                            smtp.DeliveryMethod = System.Net.Mail.SmtpDeliveryMethod.Network;
                            MyMail.Body =source+":"+ err;
                            MyMail.To.Clear();
                            MyMail.To.Add(promptmailbox);
                            try
                            {
                                smtp.Send(MyMail);
                            }
                            catch (Exception ex)
                            {
                                throw new Exception("邮件发送失败:" + ex.Message);
                            }
                        }
                        else
                        {
                            throw new Exception("未设置邮件服务器，系统错误不能邮件提醒!");
                        }
                    }
                    connection.Close();
                    return true;
                }
                catch (Exception ex)
                {
                    command.Parameters.Add(new SqlParameter("@err", ex.Message+"("+err+")"));
                    command.CommandText = "insert into R_syslog (op_time,op_id,optype,subject,remark) values( getdate(),null,'接口','通知邮件', @err)";
                    command.ExecuteNonQuery();
                    connection.Close();
                    return false;
                }
            }
            catch
            {
                return false; //如果抛出异常，就挡住了真正的异常信息
            }
        }
        private bool test_opDB(string user, string op, string domain, string appID, string registrant, string opDate, int price, int period, string exDate, string oldID, string uniID) 
        {
             SqlConnection connection = new SqlConnection(ConfigurationManager.ConnectionStrings["ConnStr"].ConnectionString);
            connection.Open();
            try
            {
                SqlCommand command = new SqlCommand("", connection);
                string _params = "user=" + user + ";op=" + op + ";domain=" + domain + ";appID=" + appID + ";registrant=" + registrant + ";opDate=" + opDate + ";price=" + price + ";period=" + period + ";exDate="+ exDate + ";oldID="+oldID + ";uniID="+uniID;
                command.CommandText = "insert into EPP_api values('done','" + _params + "')";
                command.ExecuteNonQuery();
                connection.Close();
            }
            catch (Exception ex)
            {
                connection.Close();
                throw new Exception(ex.Message);
            }
            return false;
        }
    }
}
