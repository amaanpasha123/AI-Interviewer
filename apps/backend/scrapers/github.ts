import axios from "axios";
import { describe } from "zod/v4/core";

export async function scrapeGithub(username : String){
    const userRepos = await axios.get(`https://api.github.com/users/${username}/repos`);
    return  userRepos.data.map((x:any)=>({
        description : x.description,
        name:x.name,
        fullname : x.fullname,
        startCount : x.stargazers_count
    }));
}