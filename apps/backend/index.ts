import express from "express"
import { preInterviewBody } from "./types";
const app = express();

app.use(express.json);

app.post("/api/v1/pre-interview", (req, res)=>{
    const {success, data} = preInterviewBody.safeParse(req.body);
    if(!success){
        res.status(411).json({
            message : "Incorrect body"
        });
        return
    }
    const githubUrl = data.github; // https://github.com/amaanpasha
    const linkedinUrl = data.linkedin;
    
    const githubUsername = githubUrl.split("/").pop();
    const linkedinUsername = linkedinUrl.split("/").pop();
})

app.listen(3001)