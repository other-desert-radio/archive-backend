import { sql } from "kysely";

// Match JavaScript trim() for legacy titles as well as normalized API input.
export const normalizedTagTitle = sql<string>`lower(btrim(title, ${sql.lit(" \t\n\r\f\v\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff")}))`;
