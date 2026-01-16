export type DTOType = {
    id: string
    isDeleted: boolean    
    createDate: Date
    updateDate: Date | null
}

export abstract class DTO<T extends DTOType> {

    public id: string = ""
    public isDeleted: boolean = false
    public createDate: Date = new Date()
    public updateDate: Date | null = null

    protected _tableName: string = ""

    protected abstract setChildFromObject(obj: any): void;

    protected abstract setChildFromDBObject(obj: any): void;

    protected abstract getChildAsObject(): Omit<T, keyof DTOType>;

    protected baseVarToCol = {
        id: "id",
        isDeleted: "is_deleted",
        createDate: "create_date",
        updateDate: "update_date",
    };

    public computedVarToCol: {[key in keyof Omit<T, keyof DTOType>]?: string} = {}

    public abstract childVarToCol: { [key in keyof Omit<T, keyof DTOType>]: string };

    public get varToCol(): { [key in keyof T]: string } {
        return { ...this.baseVarToCol, ...this.childVarToCol } as { [key in keyof T]: string };
    }

    constructor(tableName: string) {
        this._tableName = tableName
    }

    public setFromObject(obj: any): this {
        obj ??= {}
        this.id = DTO.assignIfTypeMatches(this.id, obj["id"], "string") as string
        this.isDeleted = DTO.assignIfTypeMatches(this.isDeleted, obj["isDeleted"], "boolean") as boolean
        this.createDate = DTO.assignIfTypeMatches(this.createDate, obj["createDate"], Date) as Date
        this.updateDate = DTO.assignIfTypeMatches(this.updateDate, obj["updateDate"], Date, true) as Date | null
        this.setChildFromObject(obj)
        return this;
    }

    public setFromDBObject(obj: any): this {
        obj ??= {};
        this.id = DTO.assignIfTypeMatches(this.id, obj[this.varToCol["id"]], "string") as string;
        this.isDeleted = DTO.assignIfTypeMatches(this.isDeleted, obj[this.varToCol["isDeleted"]], "boolean") as boolean;
        this.createDate = DTO.assignIfTypeMatches(this.createDate, obj[this.varToCol["createDate"]], Date) as Date;
        this.updateDate = DTO.assignIfTypeMatches(this.updateDate, obj[this.varToCol["updateDate"]], Date, true) as Date | null;
        this.setChildFromDBObject(obj);
        return this;
    }

    public static assignIfTypeMatches<T>(target: T, source: any, type: string | Function, allowNull: boolean = false): T | null {
        if (source === undefined) {
            return target;
        }
        if (source === null) {
            return allowNull ? null : target;
        }
        if (typeof type === 'string') {
            if (typeof source === type) {
                return source as T;
            }
        } else if (typeof type === 'function') {
            if (source instanceof type) {
                return source as T;
            }
        }
        console.warn(target, source, type, allowNull)
        console.warn(`Type mismatch: Expected ${typeof type === 'string' ? type : type.name}, but received ${typeof source}`);
        return target;
    }

    public get tableName() {
        return this._tableName
    }

    public getAsObject(): Omit<T, keyof DTOType> & { id: string, isDeleted: boolean, createDate: Date, updateDate: Date | null } {
        const baseObject = {
            id: this.id,
            isDeleted: this.isDeleted,
            createDate: this.createDate,
            updateDate: this.updateDate,
        };
        const childObject = this.getChildAsObject();
        return { ...baseObject, ...childObject };
    }

    public getAsDBObject(): { [key: string]: any } {
        const dbObject: { [key: string]: any } = {};
        const dtoObject = this.getAsObject();

        for (const key in this.varToCol) {
            if (Object.prototype.hasOwnProperty.call(this.varToCol, key)) {
                const colName = this.varToCol[key as keyof T];
                if (Object.prototype.hasOwnProperty.call(dtoObject, key)) {
                    dbObject[colName] = (dtoObject as any)[key];
                }
            }
        }

        return dbObject;
    }
}