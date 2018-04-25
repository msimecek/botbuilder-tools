/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
module.exports = {
    generateMarkdown(program) {
        try {
            // is there an output folder?
            var outFolder = process.cwd();
            var LUISJSON = {
                "sourceFile": "",
                "model": {}
            };
            var QnAJSON = {
                "sourceFile": "",
                "model": []
            };
            if(program.out_folder) {
                if(path.isAbsolute(program.out_folder)) {
                    outFolder = program.out_folder;
                } else {
                    outFolder = path.resolve('', program.out_folder);
                }
                if(!fs.existsSync(outFolder)) {
                    console.error(chalk.default.redBright('\nOutput folder ' + outFolder + ' does not exist\n'));
                    process.exit(1);
                }
            }
            
            // Do we have a LUIS file? If so, get that and load into memory
            if(program.LUIS_File) {
                LUISJSON.model = parseLUISFile(program.LUIS_File);
                LUISJSON.sourceFile = program.LUIS_File;
            }

            // Do we have a QnA file? if so, get that and load into memory
            if(program.QNA_File) {
                QnAJSON.model.push(parseQnAFile(program.QNA_File));
                QnAJSON.sourceFile = program.QNA_File;
            }

            // construct the markdown file content
            var outFileContent = constructMdFile(LUISJSON, QnAJSON, program.LUIS_File, program.QNA_File);

            if(!outFileContent) {
                console.error(chalk.default.redBright('\nSorry, Unable to generate .lu file content!\n'));
                process.exit(1);
            }

            if(!program.lu_File) {
                var outFileName = '';
                if(LUISJSON.sourceFile) {
                    outFileName += path.basename(LUISJSON.sourceFile, path.extname(LUISJSON.sourceFile));
                }
                if(QnAJSON.sourceFile) {
                    outFileName += path.basename(QnAJSON.sourceFile, path.extname(QnAJSON.sourceFile));
                }   
                program.lu_File = outFileName + '.lu'; 
            } else {
                if(program.lu_File.lastIndexOf(".lu") === -1) {
                    program.lu_File += '.lu';
                }
            }
            if(fs.existsSync(outFolder + '\\' + program.lu_File)) {
                console.error(chalk.default.redBright('Output file: ' + program.lu_File + 'exists! Use -n <lu file name> to specify an output file name.\n'));
                process.exit(1);
            }

            fs.writeFile(outFolder + '\\' + program.lu_File, outFileContent, function (err) {
                if (err) return console.log(err);
                if(!program.quiet) console.log(chalk.white('Successfully wrote to ' + outFolder + '\\' + program.lu_File));
              });
            

        } catch (err) {
            console.error(chalk.default.redBright('Oops! Something went wrong.\n'));
            console.error(chalk.yellow(err));
            process.exit(1);
        }
    }
};
/**
 * helper function to parse QnAMaker TSV file into a JSON object
 *
  * @param {String} file input LUIS JSON file name
  * @returns {object} LUIS JSON object
 */
var parseLUISFile = function(file) {
    if(!fs.existsSync(path.resolve(file))) {
        console.error(chalk.default.redBright('Sorry unable to open [' + file + ']\n'));        
        process.exit(1);
    }
    var LUISFileContent = fs.readFileSync(file,'utf8');
    if (!LUISFileContent) {
        console.error(chalk.default.redBright('Sorry, error reading file:' + file + '\n'));    
        process.exit(1);
    }
    LUISJSON = JSON.parse(LUISFileContent);
    if(LUISJSON.composites && LUISJSON.composites.length !== 0) {
        console.error(chalk.default.redBright('Sorry, input LUIS JSON file has references to composite entities. Cannot convert to .lu file.\n'));    
        process.exit(1);
    }
    if(LUISJSON.regex_entities && LUISJSON.regex_entities.length !== 0) {
        console.error(chalk.default.redBright('Sorry, input LUIS JSON file has references to regular expression entities. Cannot convert to .lu file.\n'));    
        process.exit(1);
    }
    if(LUISJSON.regex_features && LUISJSON.regex_features.length !== 0) {
        console.error(chalk.default.redBright('Sorry, input LUIS JSON file has references to regex_features. Cannot convert to .lu file.\n'));    
        process.exit(1);
    }
    return LUISJSON;
};
/**
 * helper function to parse QnAMaker TSV file into a JSON object
 *
  * @param {String} file input QnA TSV file name
  * @returns {object} QnA JSON object
 */
var parseQnAFile = function (file) {
    var QnAJSON = [];
    if(!fs.existsSync(path.resolve(file))) {
        console.error(chalk.default.redBright('Sorry unable to open [' + file + ']\n'));        
        process.exit(1);
    }
    var QnAFileContent = fs.readFileSync(file,'utf8');
    if (!QnAFileContent) {
        console.error(chalk.default.redBright('Sorry, error reading file:' + file + '\n'));    
        process.exit(1);
    }
    QnAFileContentByLine = QnAFileContent.split(/\r\n|\r|\n/g);
    //skip the first line
    QnAFileContentByLine.splice(0,1);
    QnAFileContentByLine.forEach(function(line){
        qnaPair = line.split(/\t/g);
        if(qnaPair[0]) {
            // do we already have this answer? 
            var answerObject = QnAJSON.filter(function(item) {
                return item.answer == qnaPair[1];
            });
            if(answerObject.length === 0) {
                QnAJSON.push({
                    "questions": [qnaPair[0]],
                    "answer": qnaPair[1],
                    "source": qnaPair[2]
                });
            } else {
                answerObject[0].questions.push(qnaPair[0]);
            }
        }
    });
    return QnAJSON;
};
/**
 * helper function to construct the file content based on parsed luis and qna objects
 *
 * @param {object} LUISJSON Path to the root file passed in command line
 * @param {object} QnAJSON content flushed out by commander
 * @param {String} luisFile input LUIS JSON file name
 * @param {String} QnAFile input QnA TSV file name
 * @returns {String} file content to flush to disk
 */
var constructMdFile = function(LUISJSON, QnAJSON, luisFile, QnAFile) {
    var fileContent = "";
    var NEWLINE = '\r\n';
    var luisObj = {
        "intents" : [],
        "patterns" : {}
    };
    //fileContent = JSON.stringify(LUISJSON) + '\r\n-------\r\n' + JSON.stringify(QnAJSON);
    // go through LUIS stuff
    if(LUISJSON.model.intents.length >= 0) {
        LUISJSON.model.intents.forEach(function(intent) {
            luisObj.intents.push({
                "intent" : intent,
                "utterances" : []
            });
        });
    }
    if(LUISJSON.model.utterances.length >= 0) {
        LUISJSON.model.utterances.forEach(function(utteranceObj) {
            var intentInObj = luisObj.intents.filter(function(item) {
                return item.intent.name == utteranceObj.intent;
            });
            intentInObj[0].utterances.push(utteranceObj);
        });
    }

    // TODO: fix duplicate utterances due to patterns.
    if(LUISJSON.model.patterns.length >= 0) {
        LUISJSON.model.patterns.forEach(function(patternObj) {
            var intentInObj = luisObj.intents.filter(function(item) {
                return item.intent.name == patternObj.intent;
            });
            // only push this utterance if it does not already exist
            var utteranceExists = intentInObj[0].utterances.filter(function(utterance) {
                return utterance.text == patternObj.text;
            });
            if(utteranceExists.length === 0) {
                intentInObj[0].utterances.push({
                    "text": patternObj.text,
                    "intent": patternObj.intent,
                    "entities": []
                });
            }
        });
    }

    if(luisObj.intents.length >= 0) {
        fileContent += NEWLINE;
        fileContent += '> # Intent definitions' + NEWLINE + NEWLINE;
        // write out intents and utterances..
        luisObj.intents.forEach(function(intent) {
            fileContent += '## ' + intent.intent.name + NEWLINE;
            intent.utterances.forEach(function(utterance) {
                if(utterance.entities.length >= 0) {
                    // update utterance for each entity
                    var text = utterance.text;
                    utterance.entities.forEach(function(entity) {
                        var label = text.substring(entity.startPos, entity.endPos + 1);
                        var entityWithLabel = '{' + entity.entity + '=' + label + '}';
                        var startText = text.substring(0,entity.startPos);
                        var endText = text.substring(entity.endPos + 1);
                        text = startText + entityWithLabel + endText;
                    })
                }
                fileContent += '- ' + text + NEWLINE;
            });
            fileContent += NEWLINE + NEWLINE;
        });
    }
    
    if(LUISJSON.model.entities.length >= 0) {
        fileContent += '> # Entity definitions' + NEWLINE + NEWLINE;
        LUISJSON.model.entities.forEach(function(entity) {
            fileContent += '$' + entity.name + ':simple' + NEWLINE + NEWLINE;
        });
        fileContent += NEWLINE;
    }

    if(LUISJSON.model.bing_entities.length >= 0){
        fileContent += '> # PREBUILT Entity definitions' + NEWLINE + NEWLINE;
        LUISJSON.model.bing_entities.forEach(function(entity) {
            fileContent += '$PREBUILT:' + entity + NEWLINE + NEWLINE;
        });
        fileContent += NEWLINE;
    }

    if(LUISJSON.model.model_features.length >= 0) {
        fileContent += '> # Phrase list definitions' + NEWLINE + NEWLINE;
        LUISJSON.model.model_features.forEach(function(entity) {
            fileContent += '$' + entity.name + ':phraseList' + NEWLINE;
            fileContent += '- ' + entity.words + NEWLINE;
        });
        fileContent += NEWLINE;
    }
    if(LUISJSON.model.closedLists.length >= 0){
        fileContent += '> # List entities' + NEWLINE + NEWLINE;
        LUISJSON.model.closedLists.forEach(function(ListItem) {
            ListItem.subLists.forEach(function(list) {
                fileContent += '$' + ListItem.name + ':' + list.canonicalForm + '=' + NEWLINE;
                list.list.forEach(function(listItem) {
                    fileContent += '- ' + listItem + NEWLINE;
                });
                fileContent += NEWLINE;
            });
            fileContent += NEWLINE + NEWLINE;
        });
    }
    
    // go through anything in QnAJSON .. 

    if(QnAJSON.model.length !== 0) {
        fileContent += '> # QnA pairs' + NEWLINE + NEWLINE;
        QnAJSON.model[0].forEach(function(qnaPair) {
            fileContent += '> Source: ' + qnaPair.source + NEWLINE;
            fileContent += '## ? ' + qnaPair.questions[0] + NEWLINE;
            qnaPair.questions.splice(0,1);
            qnaPair.questions.forEach(function(question) {
                fileContent += '- ' + question + NEWLINE;
            });
            fileContent += NEWLINE;
            fileContent += '```markdown' + NEWLINE + qnaPair.answer + NEWLINE + '```' + NEWLINE + NEWLINE;
        })
    }
    if(fileContent) {
        var now = new Date();
        fileContent = '> ! Automatically generated by LUDown, ' + now.toString() + NEWLINE + 
                      '> ! Source LUIS JSON file:' + luisFile + NEWLINE + 
                      '> ! Source QnA TSV file:' + QnAFile + NEWLINE + fileContent;
    }
    return fileContent;
}