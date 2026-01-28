<img src ="https://img.shields.io/badge/TypeScript-v5.9.3-blue"/> <img src ="https://img.shields.io/badge/PG-v8.17.1-red"/>


<img width="1472" height="704" alt="Gemini_Generated_Image_kpbzoskpbzoskpbz (1)" src="https://github.com/user-attachments/assets/db4dc37c-e88e-4f48-bfd4-768b0c0333c9" />

## Autoscript ORM
### Description 
Autoscript is a lite TypeScript ORM for [PostgreSQL](https://www.npmjs.com/package/pg). </br>
NPM Link: [https://www.npmjs.com/package/autoscriptorm](https://www.npmjs.com/package/autoscriptorm)

### Installation
```
npm i autoscriptorm
```

### Prerequisite & Rules
- Every table must have the following fields:
    - id [uuid, generated, not null]
    - is_deleted [boolean, default = false, not null]
    - create_date [timestamp, default = now(), not null]
    - update_date [timestamp]
- The orm does not keep track of table relationships(Foraign Key).
- The orm does not hard delete any row it sets `is_deleted = false` for the deleted row.

### Supported MySQL functions
- CREATE
- UPDATE
- DELETE
- READ
- WHERE `=` `!=` `<>` `<` `>` `<=` `>=` `like` `in` `not in` `is null` `is not null`
- ORDER BY `ASC` `DESC`
- OFFSET
- LIMIT
- INNER JOIN
- LEFT JOIN
- RIGHT JOIN
- VIRTUAL COLUMN

### How To Use

#### For raw sql query you can use `query()` function

```typescript
import { query, configureDB } from 'autoscript'

// 1. Set credentials once at startup
configureDB({
    user: 'my_user',
    host: 'localhost',
    database: 'my_db',
    password: 'password123',
    port: 1234
})

async function main() {
    console.log(await query("SELECT * FROM user"))
}

main()
```

#### A DTO class represents a table and its columns. Every `TableDTO` should extend `DTO` class and implement functions 
- `setChildFromObject(obj: any): void` : setter for column data from a object
- `setChildFromDBObject(obj: any): void` : setter for column data from a db response object
- `getChildAsObject(): Omit<T, keyof DTOType>` : getter for column data of the class

#### Also every `TableDTO` should implement object
- `childVarToCol:{[key in keyof Omit<T, keyof DTOType>]:string}` : mapping of db column to class column variables

#### For virtual columns `computedVarToCol` can be used to map column and expression

#### Here is an example of how to create a `DTO`:

```typescript
export type DummyDTOType = DTOType & {
    firstName: string, // Actual Column
    calculatedCol: string //Virtual Column
}

export class DummyDTO extends DTO<DummyDTOType> {

    public firstName: string = "" // Variable for actual Column
    public calculatedCol: string = "" // Variable for virtual Column
    
    public childVarToCol = {
        firstName: "first_name", // Actual column name in the database
        calculatedCol: "calculated_col", // Virtual column name
    }

    public override computedVarToCol = {
        // Virtual column expression
        calculatedCol: "CONCAT(first_name, 'potato')" 
    }

    constructor() {
        // Must pass database table name
        super("dummy")
    }

    // Since `calculatedCol` is a virtual column we won't set it in the setter
    // You can use the helper function (assignIfTypeMatches) to enforce typecheck
    protected setChildFromObject(obj: any): void {
        obj ??= {}
        this.firstName = DTO.assignIfTypeMatches(this.firstName, obj["firstName"], "string") as string
    }

    // We will set both properties because this is used for db serialization
    protected setChildFromDBObject(obj: any): void {
        obj ??= {}
        this.firstName = obj[this.varToCol["firstName"]]
        this.calculatedCol = obj[this.varToCol["calculatedCol"]]
    }

    // Getter for table data
    protected getChildAsObject() {
        return {
            firstName: this.firstName,
            calculatedCol: this.calculatedCol
        }
    }

}
```

#### `TableDAO` class is responsible for crud operation. So, after creating the `DTO` class it is recommanded to create a `DAO` class for that table. 

#### Here is an example of how to create a `DAO`:

```typescript
import { DummyDTO, type DummyDTOType } from "./Dummy1DTO.ts"
import { DAO } from "autoscript"

export class DummyDAO extends DAO<DummyDTOType, DummyDTO> {
    public constructor() {
        super(Dummy1DTO)
    }
}
```

#### Here is an example of how to use the `DAO` class:

```typescript
import { configureDB } from 'autoscript'
import DummyDAO from 'DummyDAO.ts'

// 1. Set credentials once at startup
configureDB({
    user: 'my_user',
    host: 'localhost',
    database: 'my_db',
    password: 'password123',
    port: 1234
})

async function main() {

    let dummyDAO = new DummyDAO()

    // Gets all rows
    let dtos = await dummyDAO.execute() 
    if(dtos != null) {
        console.log(dtos.map(e => e.getAsObject()))
    }

    //  [
    //      {
    //          id: 04e45af8-bd52-495a-93e5-3cd09c29ea63,
    //          isDeleted: false,
    //          createDate: '2025-02-28T06:05:20.380Z',
    //          updateDate: '',
    //          firstName: 'Jhon',
    //          calculatedCol: 'Jhonpotato'
    //      },
    //      {
    //          id: 0e9e0d4f-f390-40dc-b675-91a704e58658,
    //          isDeleted: false,
    //          createDate: '2025-02-28T06:05:20.380Z',
    //          updateDate: '',
    //          firstName: 'Doe',
    //          calculatedCol: 'Doepotato'
    //      }
    //  ]

    // Gets rows that satisfies where clause
    dtos = await dummyDAO.where("firstName", "=", "Jhon").execute() 
    if(dtos != null) {
        console.log(dtos.map(e => e.getAsObject()))
    }
    //  [
    //      {
    //          id: 04e45af8-bd52-495a-93e5-3cd09c29ea63,
    //          isDeleted: false,
    //          createDate: '2025-02-28T06:05:20.380Z',
    //          updateDate: '',
    //          firstName: 'Jhon',
    //          calculatedCol: 'Jhonpotato'
    //      }
    //  ]

    // Gets rows that satisfies chained where clause
    dtos = await dummyDAO
        .where("firstName", "=", "Jhon")
        .or()
        .where("firstName", "=", "Doe")
        .execute() 
    if(dtos != null) {
        console.log(dtos.map(e => e.getAsObject()))
    }
    
    //  [
    //      {
    //          id: 04e45af8-bd52-495a-93e5-3cd09c29ea63,
    //          isDeleted: false,
    //          createDate: '2025-02-28T06:05:20.380Z',
    //          updateDate: '',
    //          firstName: 'Jhon',
    //          calculatedCol: 'Jhonpotato'
    //      },
    //      {
    //          id: 0e9e0d4f-f390-40dc-b675-91a704e58658,
    //          isDeleted: false,
    //          createDate: '2025-02-28T06:05:20.380Z',
    //          updateDate: '',
    //          firstName: 'Doe',
    //          calculatedCol: 'Doepotato'
    //      }
    //  ]

}

main()
```

#### For join operation `JoinDAO` class needs to be used. This class can be used to perform `innerJoin`, `leftJoin`, `rightJoin` and `where` operations. Also virtual columns can be added based on multiple tables. Here is an example:

```typescript
    import { configureDB } from 'autoscript'

    let result = await new JoinDAO(new Dummy1DAO())
        .innerJoin(new Dummy2DAO(), "table1.name1", "table2.name2")
        .leftJoin(new Dummy3DAO(), "table2.name2", "table3.name3")
        .rightJoin(new Dummy4DAO(), "table4.name4", "table3.name3")
        .addComputedColumn("col1", "CONCAT(table1.name1, table2.name2)")
        .where("table1.name1", "=", "potato")
        .and()
        .where("table2.name2", "=", "tomato")
        .execute()

    if(result!=null) {
        result.map(e => {
            console.log(
                e[0].getAsObject(), //Dummy1DTO
                e[1].getAsObject(), //Dummy2DTO
                e[2].getAsObject(), //Dummy3DTO
                e[3].getAsObject(), //Dummy4DTO
                e[4] //Record<"col1", any>
            )
        })
    }
```

#### If in any case execute cannot be called instantly, `AnyJoinDAO` type will be needed to chain methods later. But this cause typescript from tracking types. Here is an example:

```typescript
    import { type AnyJoinDAO, configureDB } from 'autoscript'

    let joinDAO: AnyJoinDAO = new JoinDAO(new Dummy1DAO())
        .innerJoin(new Dummy2DAO(), "table1.name1", "table2.name2")
    
    if(/*SomeLogic*/) {
        joinDAO = joinDAO
            .leftJoin(new Dummy3DAO(), "table2.name2", "table3.name3")
            .rightJoin(new Dummy4DAO(), "table4.name4", "table3.name3")        
    }

    result = await joinDAO.execute()

    if(result!=null) {
        result.map(e => {
            console.log(
                (e[0] as Dummy1DTO).getAsObject(),
                (e[1] as Dummy2DTO).getAsObject(),
                (e[2] as Dummy3DTO).getAsObject(),
                (e[3] as Dummy4DTO).getAsObject()
            )
        })
    }
```
