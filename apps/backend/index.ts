import express from "express"
import { preInterviewBody } from "./types";
import axios from "axios";
const app = express();

app.use(express.json);

app.post("/api/v1/pre-interview", async (req, res)=>{
    const {success, data} = preInterviewBody.safeParse(req.body);
    if(!success){
        res.status(411).json({
            message : "Incorrect body"
        });
        return
    }
    const githubUrl = data.github.endsWith("/") ? data.github.slice(0,-1) : data.github; // https://github.com/amaanpasha
    
    const githubUsername = githubUrl.split("/").pop();


    // const userRepos = await axios.get(`https://api.github.com/${githubUsername}/repos`);
    // const filteredUserRepos = userRepos.data.map((x:any)=> ({
    //     description : x.description,
    //     name : x.name,
    //     fullname : x.name,
    //     starCount : x.stargazers_count
    // }));


    // console.log(filteredUserRepos);

    //First Difficult part scraping the linkedin for user over here ....

    const githubData = await scrapeGithub(githubUsername);
    console.log(githubData);
    res.json({github : githubData});


})

app.listen(3001)