export async function createQueryClient(){
 throw new Error('No PostgreSQL driver is bundled. Install the approved production driver and replace this factory, or point MI_QUERY_CLIENT_MODULE at the deployment-specific client factory.');
}
