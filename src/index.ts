import axios from "axios"
import Papa, { ParseResult, ParseWorkerConfig } from 'papaparse'

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

export const fetchTableFile = async ({ format = "ffcsv", area = "all", ...rest }: { username: string, password: string, name: string, format?: string, area?: string }) => {
    const response = await axios.get(`/2020/data/tablefile`, {
        params: {
            ...rest,
            area,
            format,
            language: "de"
        }
    })
    if (response.status === 200 && format === "ffcsv") {
        const result = await parseCSV(response.data, { header: true })
        return result.data        
    }
    return response.data
}