import { DTO, type DTOType } from "./DTO.js"
import query from "./Query.js"
import { DAO } from "./DAO.js"

type TablePrefix<T, N extends number> = {
    [K in keyof T as `table${N}.${K & string}`]: T[K]
}

type Join<
    T extends DTOType,
    TDTO extends DTO<T>,
    T1 extends DTOType,    
    TDTO1 extends DTO<T1>,
    R extends string,
    L extends any[],
> = JoinDAO<
    DTOType & (L["length"] extends 1 ? TablePrefix<T, 1> : T) & TablePrefix<T1, [...L, unknown]["length"]>,
    DTO<DTOType & (L["length"] extends 1 ? TablePrefix<T, 1> : T) & TablePrefix<T1, [...L, unknown]["length"]>>,
    R,
    [...L, TDTO1]
>

type ColType<
    L extends any[],
    T extends DTOType,
    T1 extends DTOType
> = keyof ((L["length"] extends 1?TablePrefix<T,1>:T) & TablePrefix<T1, [...L, unknown]["length"]>)

type ColWithTablePrefix<
    L extends any[],
    T extends DTOType
> = keyof (L["length"] extends 1?TablePrefix<T,1>:T)

export type AnyJoinDAO = JoinDAO<any, any, any, any>

export class JoinDAO<T extends DTOType, TDTO extends DTO<T>, R extends string, L extends any[] = [TDTO]> {

    private query = ""
    private params: any[] = []
    private dtoList: DTO<any>[] = []
    private dtoTypeList: (new() => DTO<any>)[] = []

    protected whereArray: { condition: string, params: any[] }[] = [];
    protected orderArray: string[] = []
    protected distinctArray: string[] = []
    protected limitValue:  number | undefined = undefined
    protected offsetValue: number | undefined = undefined
    protected computedColumn: Record<R, string> = {} as Record<R, string>

    protected resetQueryClauses(): void {
        this.query = ""
        this.params = []
        this.dtoList = []
        this.dtoTypeList = []
        this.whereArray = []
        this.distinctArray = []
        this.orderArray = []
        this.computedColumn = {} as any
        this.limitValue = 100
        this.offsetValue = 0
    }

    public constructor(dao: DAO<T, TDTO>) {
        this.dtoList.push(dao.dto)
        this.dtoTypeList.push(dao.dtoType)
        let {queryText, queryParams} = dao.queryBuilder("table1", undefined, undefined, true)
        this.query = ` (${queryText}) AS t1 `
        queryParams.forEach(e => this.params.push(e))
    }

    private varNameToColumn(col: string, dtoList: any[]) {
        let match = col.match(/^table(\d+)\.([a-zA-Z0-9._-]+)$/)
        if(match) {
            let index = match[1]
            let varName = match[2]
            let colName = dtoList[Number.parseInt(index)-1].varToCol[varName]
            return `table${index}_${colName}`
        }
        return col
    }

    public innerJoin<T1 extends DTOType, TDTO1 extends DTO<T1>>(
        dao: DAO<T1, TDTO1>, 
        onCol1: ColType<L, T, T1>, 
        onCol2: ColType<L, T, T1>
    ) {
        this.dtoList.push(dao.dto)
        let columnName1 = this.varNameToColumn(onCol1 as string, this.dtoList)
        let columnName2 = this.varNameToColumn(onCol2 as string, this.dtoList)
        this.dtoTypeList.push(dao.dtoType)
        let {queryText, queryParams} = dao.queryBuilder(`table${this.dtoList.length}`, undefined, undefined, true)
        this.query += ` INNER JOIN (${queryText}) as t${this.dtoList.length} ON ${columnName1} = ${columnName2} `
        queryParams.forEach(e => this.params.push(e))
        return this as Join<T, TDTO, T1, TDTO1, R, L>
    }

    public leftJoin<T1 extends DTOType, TDTO1 extends DTO<T1>>(
        dao: DAO<T1, TDTO1>, 
        onCol1: ColType<L, T, T1>, 
        onCol2: ColType<L, T, T1>
    ) {
        this.dtoList.push(dao.dto)
        let columnName1 = this.varNameToColumn(onCol1 as string, this.dtoList)
        let columnName2 = this.varNameToColumn(onCol2 as string, this.dtoList)
        this.dtoTypeList.push(dao.dtoType)
        let {queryText, queryParams} = dao.queryBuilder(`table${this.dtoList.length}`, undefined, undefined, true)
        this.query += ` LEFT JOIN (${queryText}) as t${this.dtoList.length} ON ${columnName1} = ${columnName2} `
        queryParams.forEach(e => this.params.push(e))
        return this as Join<T, TDTO, T1, TDTO1, R, L>
    }

    public rightJoin<T1 extends DTOType, TDTO1 extends DTO<T1>>(
        dao: DAO<T1, TDTO1>, 
        onCol1: ColType<L, T, T1>, 
        onCol2: ColType<L, T, T1>
    ) {
        this.dtoList.push(dao.dto)
        let columnName1 = this.varNameToColumn(onCol1 as string, this.dtoList)
        let columnName2 = this.varNameToColumn(onCol2 as string, this.dtoList)
        this.dtoTypeList.push(dao.dtoType)
        let {queryText, queryParams} = dao.queryBuilder(`table${this.dtoList.length}`, undefined, undefined, true)
        this.query += ` RIGHT JOIN (${queryText}) as t${this.dtoList.length} ON ${columnName1} = ${columnName2} `
        queryParams.forEach(e => this.params.push(e))
        return this as Join<T, TDTO, T1, TDTO1, R, L>
    }

    public addComputedColumn<R1 extends R>(column: R1, ...expression: Array<ColWithTablePrefix<L, T> | (string & {})>) {
        this.computedColumn[column] = expression.map(e => this.varNameToColumn(e as string, this.dtoList)).join("")
        return this as JoinDAO<T, TDTO, R&R1, L>
    }

    public distinct(column: ColWithTablePrefix<L, T>[]) {
        this.distinctArray = column.map(e => {
            return this.varNameToColumn(e as string, this.dtoList)
        })
        return this
    }

    public where(
        column: ColWithTablePrefix<L, T>,
        operator: "=" | "!=" | "<>" | "<" | ">" | "<=" | ">=" | "like" | "in" | "not in" | "is null" | "is not null",
        value?: string | number | boolean | Date | null | (string | number | boolean | Date)[]
    ) {

        let columnName = this.varNameToColumn(column as string, this.dtoList)
        if (operator === "in" || operator === "not in") {
            if (!Array.isArray(value)) {
                console.warn(`Invalid value for '${operator}' operator`);
                return this
            }
            if(value.length === 0) {
                this.whereArray.push({ condition: "1 = 1", params: [] })
                return this
            }
            const placeholders = value.map(() => `$`).join(", ")
            const condition = `${columnName as string} ${operator} (${placeholders})`
            this.whereArray.push({ condition, params: value as any[] })
            return this
        }

        if(operator === "is null" || operator === "is not null") {
            this.whereArray.push({ condition: `${columnName as string} ${operator}`, params: [] })
            return this
        }

        if(value === null || value === undefined) {
            console.warn(`Invalid value for '${operator}' operator. Must be a non null value`);
            return this
        }
        
        this.whereArray.push({ condition: `${columnName as string} ${operator} $ `, params: [value] })
        return this;

    }

    public and() { 
        this.whereArray.push({ condition: "AND", params: [] })
        return this
    }
    public or() { 
        this.whereArray.push({ condition: "OR", params: [] })
        return this
    }

    public orderBy(column: ColWithTablePrefix<L, T>, sort: "ASC" | "DESC" = "ASC") {
        let columnName = this.varNameToColumn(column as string, this.dtoList)
        this.orderArray.push(`${columnName} ${sort}`)
        return this
    }

    public limit(value: number) {
        this.limitValue = value
        return this
    }

    public offset(value: number) {
        this.offsetValue = value
        return this
    }

    public queryBuilder(limit?: number, offset?: number) {

        let distinctColumnString = ""
        if(this.distinctArray.length != 0) {
            distinctColumnString = `DISTINCT ON (${this.distinctArray.join(", ")})`
        }

        let selectString = `SELECT ${distinctColumnString} ${["*", ...Object.entries(this.computedColumn).map(([k, v]) => `${v} as ${k}`)].join(", ")} FROM `

        let whereClauses: string[] = []
        
        this.whereArray.forEach(clause => {
            let condition = clause.condition
            whereClauses.push(condition)
            this.params.push(...clause.params)
        })
        let whereString = whereClauses.length > 0 ? ` WHERE ${whereClauses.join(" ")} ` : ""
        
        let orderString = this.orderArray.length > 0 ? ` ORDER BY ${this.orderArray.join(", ")} ` : ""

        if(this.limitValue == undefined) {
            this.limitValue = limit
        }
        let limitString = this.limitValue==undefined?"": ` LIMIT ${this.limitValue} `

        if(this.offsetValue == undefined) {
            this.offsetValue = offset
        }
        let offsetString = this.offsetValue==undefined?"": ` OFFSET ${this.offsetValue} `
        
        let counter = 1
        let queryText = ` ${selectString} ${this.query} ${whereString} ${orderString} ${limitString} ${offsetString} `.replace(/\$/g, () => `$${counter++}`)

        return {queryText: queryText, queryParams: this.params}
        
    }

    public async execute() {

        let {queryText, queryParams} = this.queryBuilder(100, 0)

        try {
            let result = await query(queryText, queryParams) as any []
            if(result == null) {
                return null
            }

            let dtoList: any[] = []

            result.forEach(e => {
                let dtoMapList = Array.from({ length: this.dtoList.length + 1 }).map(() => ({}))
                Object.keys(e).forEach(k => {
                    let index = Number(k.replace("table", "").charAt(0)) - 1
                    if(Number.isNaN(index)) {
                        (dtoMapList[dtoMapList.length-1] as any)[k] = e[k]
                        return
                    }
                    let map: any = dtoMapList[index]
                    map[k.replace(`table${index+1}_`, "")] = e[k]
                    dtoMapList[index] = map
                })
                let dtoRow = [
                    ...dtoMapList.filter((_, i) => i != dtoMapList.length-1).map((v, i) => new this.dtoTypeList[i]().setFromDBObject(v)),
                    dtoMapList[dtoMapList.length-1]
                ]
                dtoList.push(dtoRow)
            })

            this.resetQueryClauses()

            return dtoList as Array<[...L, Record<R, any>]>

        } catch (err) {
            this.resetQueryClauses()
            console.error('Error in DAO join:', err)
            throw err
        }
        
    }

    public async paginatedExecute(page: number = 1, pageSize: number = 20) {

        let limit = Math.max(1, pageSize)
        let offset = (Math.max(1, page) - 1) * limit

        let {queryText, queryParams} = this.queryBuilder()
        let countQueryText = `SELECT COUNT(*) FROM (${queryText}) AS CountTable`
        queryText = ` ${queryText} LIMIT ${limit} OFFSET ${offset} `
        try {

            const countResult = await query(countQueryText, queryParams)
            if(countResult?.[0]?.count == null) {
                return null
            }

            let result = await query(queryText, queryParams) as any []
            if(result == null) {
                return null
            }

            let dtoList: any[] = []

            result.forEach(e => {
                let dtoMapList = Array.from({ length: this.dtoList.length + 1 }).map(() => ({}))
                Object.keys(e).forEach(k => {
                    let index = Number(k.replace("table", "").charAt(0)) - 1
                    if(Number.isNaN(index)) {
                        (dtoMapList[dtoMapList.length-1] as any)[k] = e[k]
                        return
                    }
                    let map: any = dtoMapList[index]
                    map[k.replace(`table${index+1}_`, "")] = e[k]
                    dtoMapList[index] = map
                })
                let dtoRow = [
                    ...dtoMapList.filter((_, i) => i != dtoMapList.length-1).map((v, i) => new this.dtoTypeList[i]().setFromDBObject(v)),
                    dtoMapList[dtoMapList.length-1]
                ]
                dtoList.push(dtoRow)
            })

            this.resetQueryClauses()

            return {
                dtoList: dtoList as Array<[...L, Record<R, any>]>,
                currentPage: page,
                pageSize: pageSize,
                totalEntries: parseInt(countResult[0].count, 10),
                totalPages: Math.ceil(parseInt(countResult[0].count, 10) / pageSize),
                hasMore: page < Math.ceil(parseInt(countResult[0].count, 10) / pageSize)
            }

        } catch (err) {
            this.resetQueryClauses()
            console.error('Error in DAO join:', err)
            throw err;
        }
        
    }

}