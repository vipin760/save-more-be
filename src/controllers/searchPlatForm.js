const { fetchPlatformData } = require("../services/searchPlatForm.service")

exports.searchAllPlatform = async(req ,res)=>{
    try {
        const data = await fetchPlatformData(req.query.query)
        res.status(200).send({status:false,data,message:"successfully fetched"})
    } catch (error) {
        return res.status(500).send({status:false,message:"internal server down", error:error.message})
    }
}