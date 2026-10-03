(() => {
    const curriculumFiles = [
        'functions.json?v=3',
        'business-mathematics.json?v=3',
        'statistics.json?v=6',
        'sequences-and-series.json?v=4',
        'logic-and-mathematical-reasoning.json?v=2',
        'measurement-and-conversion.json?v=1',
        'trigonometry.json?v=1'
    ];
    const exampleFiles = [
        'functions-examples.json?v=2',
        'business-mathematics-examples.json?v=2',
        'statistics-examples.json?v=4',
        'sequences-and-series-examples.json?v=2',
        'logic-and-mathematical-reasoning-examples.json?v=2',
        'measurement-and-conversion-examples.json?v=1',
        'trigonometry-examples.json?v=1'
    ];
    const knowledgeDirectory = new URL('knowledge/', document.currentScript.src);

    window.GRADE_11_MATH_KNOWLEDGE = [];
    window.GRADE_11_MATH_EXAMPLES = [];

    window.GRADE_11_MATH_KNOWLEDGE_READY = Promise.all(curriculumFiles.map(async fileName => {
        const response = await fetch(new URL(fileName, knowledgeDirectory));
        if (!response.ok) throw new Error(`Could not load curriculum module: ${fileName}`);

        const topic = await response.json();
        if (!topic.topicName || !Array.isArray(topic.subtopics) || !Array.isArray(topic.keywords)) {
            throw new Error(`Invalid curriculum module: ${fileName}`);
        }
        return topic;
    })).then(topics => {
        window.GRADE_11_MATH_KNOWLEDGE = topics;
        return topics;
    }).catch(error => {
        console.error('Grade 11 curriculum knowledge failed to load.', error);
        return [];
    });

    window.GRADE_11_MATH_EXAMPLES_READY = Promise.all(exampleFiles.map(async fileName => {
        const response = await fetch(new URL(fileName, knowledgeDirectory));
        if (!response.ok) throw new Error(`Could not load example module: ${fileName}`);

        const topic = await response.json();
        if (!topic.topicName || !Array.isArray(topic.examples) || typeof topic.topicOverview !== 'string') {
            throw new Error(`Invalid example module: ${fileName}`);
        }
        return topic;
    })).then(topics => {
        window.GRADE_11_MATH_EXAMPLES = topics;
        return topics;
    }).catch(error => {
        console.error('Grade 11 mathematics example bank failed to load.', error);
        return [];
    });

    window.GRADE_11_MATH_DATA_READY = Promise.all([
        window.GRADE_11_MATH_KNOWLEDGE_READY,
        window.GRADE_11_MATH_EXAMPLES_READY
    ]).then(([curriculum, examples]) => ({ curriculum, examples }));
})();
