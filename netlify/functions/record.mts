import { MongoClient, ObjectId, ServerApiVersion, type Db } from "mongodb";
import type { Config } from "@netlify/functions";

// Reuse the client across warm invocations
let clientPromise: Promise<MongoClient> | undefined;

async function getDb(): Promise<Db> {
  const uri = Netlify.env.get("ATLAS_URI");
  if (!uri) throw new Error("ATLAS_URI is not set");
  if (!clientPromise) {
    const client = new MongoClient(uri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
      appName: "devrel-github-javascript-mern",
    });
    clientPromise = client.connect().catch((err) => {
      clientPromise = undefined;
      throw err;
    });
  }
  return (await clientPromise).db("employees");
}

function toObjectId(id: string): ObjectId | null {
  return ObjectId.isValid(id) ? new ObjectId(id) : null;
}

export default async (req: Request) => {
  const id = new URL(req.url).pathname.split("/").filter(Boolean)[1];

  try {
    const collection = (await getDb()).collection("records");

    if (!id) {
      if (req.method === "GET") {
        return Response.json(await collection.find({}).toArray());
      }
      if (req.method === "POST") {
        const body = await req.json();
        const result = await collection.insertOne({
          name: body.name,
          position: body.position,
          level: body.level,
        });
        return Response.json(result);
      }
      return new Response("Method not allowed", { status: 405 });
    }

    const _id = toObjectId(id);
    if (!_id) return new Response("Not found", { status: 404 });

    if (req.method === "GET") {
      const result = await collection.findOne({ _id });
      if (!result) return new Response("Not found", { status: 404 });
      return Response.json(result);
    }
    if (req.method === "PATCH") {
      const body = await req.json();
      const result = await collection.updateOne(
        { _id },
        { $set: { name: body.name, position: body.position, level: body.level } }
      );
      return Response.json(result);
    }
    if (req.method === "DELETE") {
      return Response.json(await collection.deleteOne({ _id }));
    }
    return new Response("Method not allowed", { status: 405 });
  } catch (err) {
    console.error(err);
    return new Response("Error handling record request", { status: 500 });
  }
};

export const config: Config = {
  path: ["/record", "/record/", "/record/:id"],
};
