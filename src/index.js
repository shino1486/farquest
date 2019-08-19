const AWS = require("aws-sdk")
const logger = require("./config/logger")
const env = require("./config/environment")
const {
  runTask,
  endTask,
  waitForTaskState,
  sendPayloadToTask,
  getRunningTaskIP,
  getProperty,
} = require("./util")

exports.handler = async function(_event, _context) {
  const ecs = new AWS.ECS(env.awsAuthParams)
  const ec2 = new AWS.EC2(env.awsAuthParams)

  logger.info(
    `Starting the ${env.taskParams.taskDefinition} task on ${env.taskParams.cluster} cluster!`,
    { category: "lambda" },
  )

  try {
    const startedTask = await runTask(ecs, env.taskParams)
    const taskArn = getProperty(["tasks", 0, "taskArn"], startedTask)

    logger.warn(
      `Created task with arn: ${getProperty(
        ["tasks", 0, "taskArn"],
        startedTask,
      )}`,
      { category: "lambda" },
    )

    logger.info("Waiting for the task to be ready...", { category: "lambda" })

    await waitForTaskState(ecs, "tasksRunning", env.taskParams.cluster, taskArn)

    logger.warn("Task is running!", { category: "lambda" })
    const taskIP = await getRunningTaskIP(env.taskParams.cluster, taskArn, {
      public: process.env.NODE_ENV !== "production",
    })

    logger.info(`Got the following task ip: ${taskIP}`, { category: "lambda" })

    logger.warn("Ok! Sending payload! Chooooooo", { category: "lambda" })
    const response = await sendPayloadToTask(
      taskIP,
      env.taskPath,
      env.taskRequestMethod,
      fillContext(),
    )

    // return response
  } catch (error) {
    console.error(error)
    return error
  }

  await endTask(ecs, env.taskParams.cluster, taskArn)
  logger.info("Task killed!", { category: "lambda" })
}
