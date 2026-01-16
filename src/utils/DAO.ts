import { DTO, type DTOType } from "./DTO.js"
import query from "./Query.js";


export class DAO<T extends DTOType, TDTO extends DTO<T>> {

    protected _dtoType
    protected _dto
    protected whereArray: { condition: string, params: any[] }[] = [];
    protected orderArray: string[] = []
    protected limitValue: number | undefined = undefined
    protected offsetValue: number | undefined = undefined

    public constructor(dtoType: new() => TDTO) {
        this._dtoType = dtoType
        this._dto = new this._dtoType()
    }

    public get dtoType() {
        return this._dtoType
    }

    public get dto() {
        return this._dto
    }
    
    protected resetQueryClauses() {
        this.whereArray = []
        this.orderArray = []
        this.limitValue = undefined
        this.offsetValue = undefined
    }

    public where(
        field: keyof T,
        operator: "=" | "!=" | "<>" | "<" | ">" | "<=" | ">=" | "like" | "in" | "not in" | "is null" | "is not null",
        value?: string | number | boolean | Date | null | (string | number | boolean | Date)[],
        func?: "UPPER" | "LOWER" 
    ) {

        let colName = this.dto.varToCol[field]
        if(field in this.dto.computedVarToCol) {
            colName = (this.dto.computedVarToCol as any)[field]
        }

        if(func !== undefined) {
            colName = ` ${func}( ${colName} ) `
        }

        if (operator === "in" || operator === "not in") {
            if (!Array.isArray(value)) {
                console.warn(`Invalid value for '${operator}' operator`)
                return this
            }
            if(value.length === 0) {
                this.whereArray.push({ condition: "1 = 1", params: [] })
                return this
            }
            let placeholders = value.map(() => `$`).join(", ")
            let condition = `${colName} ${operator} (${placeholders})`
            this.whereArray.push({ condition, params: value as any[] })
            return this
        }

        if(operator === "is null" || operator === "is not null") {
            this.whereArray.push({ condition: `${colName} ${operator}`, params: [] })
            return this
        }

        if(value === null || value === undefined) {
            console.warn(`Invalid value for '${operator}' operator. Must be a non null value`);
            return this
        }
        
        this.whereArray.push({ condition: `${colName} ${operator} $ `, params: [value] })

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

    public orderBy(column: keyof T, sort: "ASC" | "DESC" = "ASC"): this {
        this.orderArray.push(`${this.dto.varToCol[column]} ${sort}`)
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

    public queryBuilder(alias?: string, limit?: number, offset?: number, join = false) {

        const whereClauses: string[] = []
        const queryParams: any[] = []

        if(this.whereArray.length != 0) {
            this.and()
        }
        this.where("isDeleted", "=", false)
        this.whereArray.forEach(clause => {
            let condition = clause.condition
            whereClauses.push(condition)
            queryParams.push(...clause.params)
        });
        let whereString = whereClauses.length > 0 ? ` WHERE ${whereClauses.join(" ")} ` : ""
        if(!join) {
            let counter = 1
            whereString = whereString.replace(/\$/g, () => `$${counter++}`)
        }

        let columnString = ""
        if(alias != undefined) {
            columnString = [
                ...Object.entries(this.dto.varToCol)
                    .filter(([k, v]) => !(k in this.dto.computedVarToCol))
                    .map(([k, v]) => `${v} AS ${alias}_${v}`),
                ...Object.entries(this.dto.computedVarToCol)
                    .map(([k, v]) => `${v} as ${alias}_${this.dto.varToCol[k as keyof typeof this.dto.varToCol]}`)
            ].join(" ,")
        } else {
            columnString = [
                "*",
                ...Object.entries(this.dto.computedVarToCol)
                    .map(([k, v]) => `${v} as ${this.dto.varToCol[k as keyof typeof this.dto.varToCol]}`)
            ].join(", ")
        }

        if(this.limitValue == undefined) {
            this.limitValue = limit
        }
        let limitString = this.limitValue==undefined?"": ` LIMIT ${this.limitValue} `

        if(this.offsetValue == undefined) {
            this.offsetValue = offset
        }
        let offsetString = this.offsetValue==undefined?"": ` OFFSET ${this.offsetValue} `

        let orderString = this.orderArray.length > 0 ? ` ORDER BY ${this.orderArray.join(", ")} ` : ""
                
        let queryText = `SELECT ${columnString} FROM ${this.dto.tableName} ${whereString} ${orderString} ${limitString} ${offsetString}`

        return {queryText: queryText, queryParams: queryParams}
        
    }

    public async execute(): Promise<TDTO[] | null> {

        let {queryText, queryParams} = this.queryBuilder(undefined, 100, 0, false)
        this.resetQueryClauses()

        try {
            const result = await query(queryText, queryParams)
            if(result == null) {
                return null
            }
            const dtoList = new Array<TDTO>()
            result.forEach(e => {
                const dto = new this.dtoType()
                dto.setFromDBObject(e)
                dtoList.push(dto)
            })
            return dtoList
        } catch (err) {
            console.error('Error in DAO execute:', err)
            throw err;
        }
        
    }
    
    public async paginatedExecute(page: number = 1, pageSize: number = 20) {

        let limit = Math.max(1, pageSize)
        let offset = (Math.max(1, page) - 1) * limit

        let {queryText, queryParams} = this.queryBuilder(undefined, undefined, undefined, false)
        let countQueryText = `SELECT COUNT(*) FROM (${queryText}) AS CountTable`
        queryText = ` ${queryText} LIMIT ${limit} OFFSET ${offset} `
        this.resetQueryClauses()

        try {
            const countResult = await query(countQueryText, queryParams)
            if(countResult?.[0]?.count == null) {
                return null
            }

            const result = await query(queryText, queryParams)
            if(result == null) {
                return null
            }
            const dtoList = new Array<TDTO>()
            result.forEach(e => {
                const dto = new this.dtoType()
                dto.setFromDBObject(e)
                dtoList.push(dto)
            })

            return {
                dtoList: dtoList,
                currentPage: page,
                pageSize: pageSize,
                totalEntries: parseInt(countResult[0].count, 10),
                totalPages: Math.ceil(parseInt(countResult[0].count, 10) / pageSize),
                hasMore: page < Math.ceil(parseInt(countResult[0].count, 10) / pageSize)
            };
            
        } catch (err) {
            console.error('Error in DAO execute:', err)
            throw err;
        }

    }

    public async read(id: string[]): Promise<TDTO[] | null>
    public async read(id: string): Promise<TDTO | null>
    public async read(id: string | string[]): Promise<TDTO | TDTO[] | null> {
        
        try {
            if(Array.isArray(id)) {
                const dtoList = await this.where("id", "in", id).execute()
                if(dtoList == null) {
                    return null
                }
                return dtoList
            }
            const dtoList = await this.where("id", "=", id).execute()
            if(dtoList == null) {
                return null
            }
            return dtoList[0]
        } catch (err) {
            console.warn("Error in DAO read", err)
            throw err
        }

    }
    
    public async create(dto: TDTO): Promise<TDTO | null>
    public async create(dto: Array<TDTO>): Promise<Array<TDTO> | null>
    public async create(dto: TDTO | Array<TDTO>): Promise<Array<TDTO> | TDTO | null> {

        if(Array.isArray(dto)) {

            if(dto.length == 0) { 
                return null 
            }
            for(let i=0; i<dto.length; i++) {
                dto[i].createDate = new Date()
                dto[i].updateDate = null
                dto[i].isDeleted = false
            }
            
            const columns = Object.entries(dto[0].varToCol)
                .filter(([k, _]) => !(k in dto[0].computedVarToCol))
                .map(([_, v]) => v)
                .filter(e => e != "id")
            const colToVar = Object.entries(dto[0].varToCol).reduce((acc, [key, value]) => ({ ...acc, [value]: key }), {}) as {[key: string]: string};
            const queryParams = dto.map(d => columns.map(col => (d as any)[colToVar[col]])).reduce((acc, val) => acc.concat(val), [])
            const placeholders = dto.map((_, i) => ` (${columns.map((__, index) => `$${(columns.length*i) + index + 1}`).join(", ")}) `).join(', ')
            const queryText = `INSERT INTO ${dto[0].tableName} (${columns.join(", ")}) VALUES ${placeholders} RETURNING id`
            
            try {
                const result = await query(queryText, queryParams)
                if(result == null) {
                    return null
                }
                result.forEach((e, i) => {
                    dto[i].id = e.id
                })
                return dto
            } catch (err) {
                console.error('Error in DAO create:', err)
                throw err;
            }

        } else {

            dto.createDate = new Date()
            dto.updateDate = null
            dto.isDeleted = false

            const colToVar = Object.entries(dto.varToCol).reduce((acc, [key, value]) => ({ ...acc, [value]: key }), {}) as {[key: string]: string};
            const columns = Object.entries(dto.varToCol)
                .filter(([k, _]) => !(k in dto.computedVarToCol))
                .map(([_, v]) => v)
                .filter(e => e != "id")            
            const queryParams = columns.map(col => (dto as any)[colToVar[col]]);
            const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
            const queryText= `INSERT INTO ${dto.tableName} (${columns.join(", ")}) VALUES (${placeholders}) RETURNING id`
            
            try {
                const result = await query(queryText, queryParams)
                if(result == null) {
                    return null
                }
                if(result[0]?.id == null) {
                    return null
                }
                dto.id = result[0].id
                return dto
            } catch (err) {
                console.error('Error in DAO create:', err)
                throw err;
            }

        }

    }
    
    public async update(dto: TDTO): Promise<TDTO | null>
    public async update(dto: Array<TDTO>): Promise<Array<TDTO> | null>
    public async update(dto: TDTO | Array<TDTO>): Promise<Array<TDTO> | TDTO | null> {

        if(Array.isArray(dto)) {
            
            if(dto.length == 0) {
                return null
            }
            const updatedDTOList: Array<TDTO> = []
            for(const eachDTO of dto) {
                try {
                    const insertDTO = await this.update(eachDTO)
                    if(insertDTO != null) {
                        updatedDTOList.push(insertDTO)
                    }
                } catch (err) {
                    console.warn("Error in DAO create:", err)
                }
            }
            return updatedDTOList

        } else {
            
            dto.updateDate = new Date()
            dto.isDeleted = false

            const colToVar = Object.entries(dto.varToCol).reduce((acc, [key, value]) => ({ ...acc, [value]: key }), {}) as {[key: string]: string};
            const columns = Object.entries(dto.varToCol)
                .filter(([k, _]) => !(k in dto.computedVarToCol))
                .map(([_, v]) => v)
                .filter(e => e != "id" && e != "createdate")
            const queryParams = columns.map(col => (dto as any)[colToVar[col]])
            queryParams.push(dto.id)
            const placeholders = columns.map((e, i) => `${e} = $${i+1}`).join(", ")
            const queryText: string = `UPDATE ${dto.tableName} SET ${placeholders} WHERE id = $${columns.length+1}`
            
            try {
                const result = await query(queryText, queryParams)
                if(result == null) {
                    return null
                }
                return dto
            } catch (err) {
                console.error('Error in DAO create:', err)
                throw err;
            }

        }
       
    }

    public async delete(dto: TDTO): Promise<boolean>
    public async delete(dto: Array<TDTO>): Promise<Array<boolean>>
    public async delete(dto: TDTO | Array<TDTO>): Promise<boolean | Array<boolean>> {

        if(Array.isArray(dto)) {

            if(dto.length == 0) {
                return false
            }
            const successList: Array<boolean> = []
            for(const eachDTO of dto) {
                successList.push(await this.delete(eachDTO))
            }
            return successList

        } else {

            const queryText: string = `UPDATE ${dto.tableName} SET is_deleted = true  WHERE id = $1 RETURNING id`
            try {
                let result = await query(queryText, [dto.id])
                return !(result[0]?.id == null)
            } catch (err) {
                console.error('Error in DAO delete:', err)
                throw err;
            }
            
        }
        
    }

}