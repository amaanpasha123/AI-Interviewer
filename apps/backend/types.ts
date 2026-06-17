import z from "zod"

export const preInterviewBody = z.object({
    linkedin : z.string(),
    github : z.string()
})

