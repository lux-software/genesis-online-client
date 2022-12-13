import axios from "axios"
import Papa, { ParseResult, ParseWorkerConfig } from 'papaparse'

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

function parseCSV<T = any>(string: string, config: Omit<ParseWorkerConfig<T>, "complete" | "worker">) {
    return new Promise<ParseResult<T>>(function (complete, error) {
        Papa.parse<T>(string, { ...config, complete, error });
    });
};

const baseUrl = process.env.BASE_URL ?? "https://www-genesis.destatis.de/genesisWS/rest"
axios.interceptors.request.use((config) => {
    config.baseURL = baseUrl
    return config
})

type GenesisTableRequest = {
    username: string,
    password: string,
    name: string,
    regionalvariable?: string,
    startyear?: string
    format?: string,
    area?: string,
    maxTry?: number
}

export const fetchTableFile = async ({ format = "ffcsv", area = "all", ...rest }: GenesisTableRequest) => {
    const response = await axios.get(`/2020/data/tablefile`, {
        params: {
            ...rest,
            area,
            format,
            language: "de"
        }
    })
    if (response.status === 200 && response.data.Status?.Code !== 99 && format === "ffcsv") {
        const result = await parseCSV(response.data, { header: true })
        return result.data
    }
    return response.data
}

export const fetchJobResult = async ({ format = "ffcsv", area = "all", ...rest }: { username: string, password: string, name: string, format?: string, area?: string }) => {
    const response = await axios.get(`/2020/data/resultfile`, {
        params: {
            ...rest,
            area,
            format,
            language: "de"
        }
    })
    return response.data
}


export const fetchTableAsJob = async ({ format = "ffcsv", area = "all", maxTry = 30, ...rest }: GenesisTableRequest) => {
    const response = await axios.get<FetchTableJobResponse>(`/2020/data/tablefile`, {
        params: {
            ...rest,
            area,
            format,
            language: "de",
            job: true
        }
    })

    if (response.data?.Status?.Code === 99) {
        const regex = new RegExp(`(${rest.name}_[0-9]*)`)
        const jobId = regex.exec(response.data.Status.Content)[0]
        let status: JobStatus = null
        let tries = 1
        do {
            await delay(10000)
            status = await getJobStatus({ ...rest, name: jobId })
            console.log(`Try ${tries} with status ${status.State}`)
            tries += 1
        } while (status.State !== 'Fertig' && tries <= maxTry);

        if (status.State === 'Fertig') {
            return fetchJobResult({ format: "ffcsv", area: "all", ...rest, name: jobId })
        }

    } else if (response.status === 200 && format === "ffcsv") {
        return response.data as unknown as string
    }

    return response as unknown as string
}

export const getJobStatus = async ({ name, ...rest }: { username: string, password: string, name: string }) => {
    const response = await axios.get<FetchJobStatusResponse>(`/2020/catalogue/jobs`, {
        params: {
            ...rest,
        }
    })
    return response.data.List.find(p => p.Code === name)
}

export type FetchJobStatusResponse = {
    List: JobStatus[]
}
export type JobStatus = {
    Content: string,
    Date: string,
    Time: string,
    State: string | 'Fertig',
    Code: string
}
export type FetchTableJobResponse = {
    Ident: { Service: string, Method: string },
    Status?: {
        Code: number,
        Content: string
        Type: string
    },
    Copyright: string
}